package com.siddur.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Downloads the new APK straight into a PackageInstaller session; the app reopens itself after the update. */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    static final String ACTION_RESULT = "com.siddur.app.INSTALL_RESULT";
    static final String PREFS = "siddur_update";
    private volatile boolean busy = false;

    private long currentVersionCode() throws Exception {
        PackageInfo pi = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
        return Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode;
    }

    private boolean canInstall() {
        return Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls();
    }

    private boolean canOverlay() {
        return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(getContext());
    }

    @PluginMethod
    public void getInfo(PluginCall call) {
        try {
            PackageInfo pi = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            JSObject o = new JSObject();
            o.put("versionName", pi.versionName);
            o.put("versionCode", currentVersionCode());
            o.put("canInstall", canInstall());
            o.put("canOverlay", canOverlay());
            call.resolve(o);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    private void openSettings(PluginCall call, String action) {
        try {
            Intent i = new Intent(action, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        openSettings(call, Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
    }

    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        openSettings(call, Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
    }


    /** Downloads a new index.html into app storage so content updates need no reinstall. */
    @PluginMethod
    public void downloadWeb(final PluginCall call) {
        final String url = call.getString("url");
        final String sha = call.getString("sha256");
        final int version = call.getInt("version", 0);
        if (url == null || !url.startsWith("https://")) {
            call.reject("bad_url");
            return;
        }
        new Thread(() -> {
            try {
                File root = new File(getContext().getFilesDir(), "web");
                File dir = new File(root, "v" + version);
                dir.mkdirs();
                File tmp = new File(dir, "index.tmp");
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setInstanceFollowRedirects(true);
                c.setConnectTimeout(15000);
                c.setReadTimeout(30000);
                c.setRequestProperty("User-Agent", "SiddurApp-Updater");
                if (c.getResponseCode() != 200) throw new Exception("http_" + c.getResponseCode());
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                try (InputStream in = c.getInputStream(); FileOutputStream fo = new FileOutputStream(tmp)) {
                    byte[] buf = new byte[32768];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        fo.write(buf, 0, n);
                        md.update(buf, 0, n);
                    }
                }
                c.disconnect();
                StringBuilder hex = new StringBuilder();
                for (byte b : md.digest()) hex.append(String.format("%02x", b));
                if (sha != null && !sha.isEmpty() && !hex.toString().equalsIgnoreCase(sha)) {
                    tmp.delete();
                    throw new Exception("checksum");
                }
                File out = new File(dir, "index.html");
                if (out.exists()) out.delete();
                if (!tmp.renameTo(out)) throw new Exception("write_failed");
                File[] olds = root.listFiles();
                if (olds != null) for (File o : olds) {
                    if (!o.equals(dir)) {
                        File[] fs = o.listFiles();
                        if (fs != null) for (File f : fs) f.delete();
                        o.delete();
                    }
                }
                getContext().getSharedPreferences(com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME, Context.MODE_PRIVATE)
                        .edit().putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, dir.getAbsolutePath()).apply();
                JSObject r = new JSObject();
                r.put("path", dir.getAbsolutePath());
                call.resolve(r);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        }).start();
    }

    @PluginMethod
    public void downloadAndInstall(final PluginCall call) {
        final String url = call.getString("url");
        if (url == null || !url.startsWith("https://")) {
            call.reject("bad_url");
            return;
        }
        if (!canInstall()) {
            call.reject("need_permission");
            return;
        }
        if (busy) {
            call.reject("busy");
            return;
        }
        busy = true;
        new Thread(() -> {
            PackageInstaller.Session session = null;
            try {
                Context ctx = getContext();
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setInstanceFollowRedirects(true);
                c.setConnectTimeout(15000);
                c.setReadTimeout(30000);
                c.setRequestProperty("User-Agent", "SiddurApp-Updater");
                int code = c.getResponseCode();
                if (code != 200) throw new Exception("http_" + code);
                long total = c.getContentLengthLong();

                PackageInstaller installer = ctx.getPackageManager().getPackageInstaller();
                PackageInstaller.SessionParams params =
                        new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                params.setAppPackageName(ctx.getPackageName());
                if (Build.VERSION.SDK_INT >= 31) {
                    params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
                }
                int id = installer.createSession(params);
                session = installer.openSession(id);

                long got = 0;
                int lastPct = -1;
                try (InputStream in = c.getInputStream();
                     OutputStream out = session.openWrite("update.apk", 0, total > 0 ? total : -1)) {
                    byte[] buf = new byte[32768];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        got += n;
                        int pct = total > 0 ? (int) (got * 100 / total) : -1;
                        if (pct != lastPct) {
                            lastPct = pct;
                            JSObject p = new JSObject();
                            p.put("percent", pct);
                            notifyListeners("progress", p);
                        }
                    }
                    session.fsync(out);
                }
                c.disconnect();

                SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                sp.edit().putBoolean("reopen", true).apply();

                Intent cb = new Intent(ctx, InstallResultReceiver.class).setAction(ACTION_RESULT);
                int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                PendingIntent pi = PendingIntent.getBroadcast(ctx, id, cb, flags);
                session.commit(pi.getIntentSender());
                session = null;
                call.resolve();
            } catch (Exception e) {
                if (session != null) {
                    try { session.abandon(); } catch (Exception ignored) {}
                }
                call.reject(String.valueOf(e.getMessage()));
            } finally {
                busy = false;
            }
        }).start();
    }
}
