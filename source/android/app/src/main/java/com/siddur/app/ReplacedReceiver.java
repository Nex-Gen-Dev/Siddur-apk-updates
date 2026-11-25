package com.siddur.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/** Runs right after this app was updated and brings it back on screen. */
public class ReplacedReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        SharedPreferences sp = context.getSharedPreferences(ApkUpdaterPlugin.PREFS, Context.MODE_PRIVATE);
        if (!sp.getBoolean("reopen", false)) return;
        sp.edit().putBoolean("reopen", false).apply();
        Intent launch = new Intent(context, MainActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        try { context.startActivity(launch); } catch (Exception ignored) {}
    }
}
