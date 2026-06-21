package com.gameapp;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.modules.core.PermissionAwareActivity;
import com.facebook.react.modules.core.PermissionListener;

public class LocalCoinNotificationModule extends ReactContextBaseJavaModule implements PermissionListener {
  private static final String CHANNEL_ID = "coin_rewards";
  private static final String CHANNEL_NAME = "코인 획득 알림";
  private static final int POST_NOTIFICATIONS_REQUEST_CODE = 4201;

  private final ReactApplicationContext reactContext;
  private Promise permissionPromise;

  LocalCoinNotificationModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return "LocalCoinNotification";
  }

  @ReactMethod
  public void requestPermission(Promise promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      promise.resolve(true);
      return;
    }

    if (reactContext.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
      promise.resolve(true);
      return;
    }

    Activity activity = getCurrentActivity();

    if (!(activity instanceof PermissionAwareActivity)) {
      promise.resolve(false);
      return;
    }

    permissionPromise = promise;
    ((PermissionAwareActivity) activity).requestPermissions(
        new String[] {Manifest.permission.POST_NOTIFICATIONS},
        POST_NOTIFICATIONS_REQUEST_CODE,
        this);
  }

  @ReactMethod
  public void showCoinReward(ReadableMap options, Promise promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
        && reactContext.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      promise.resolve(false);
      return;
    }

    String title = options.hasKey("title") ? options.getString("title") : "코인 획득";
    String body = options.hasKey("body") ? options.getString("body") : "코인을 획득했어요.";

    createNotificationChannel();

    Intent intent = reactContext.getPackageManager().getLaunchIntentForPackage(reactContext.getPackageName());

    if (intent == null) {
      intent = new Intent(reactContext, MainActivity.class);
    }

    intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

    PendingIntent pendingIntent = PendingIntent.getActivity(
        reactContext,
        0,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT | immutablePendingIntentFlag());

    Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        ? new Notification.Builder(reactContext, CHANNEL_ID)
        : new Notification.Builder(reactContext);

    Notification notification = builder
        .setSmallIcon(reactContext.getApplicationInfo().icon)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(new Notification.BigTextStyle().bigText(body))
        .setContentIntent(pendingIntent)
        .setAutoCancel(true)
        .setDefaults(Notification.DEFAULT_ALL)
        .setPriority(Notification.PRIORITY_DEFAULT)
        .build();

    NotificationManager notificationManager =
        (NotificationManager) reactContext.getSystemService(Context.NOTIFICATION_SERVICE);

    if (notificationManager == null) {
      promise.resolve(false);
      return;
    }

    notificationManager.notify((int) (System.currentTimeMillis() % Integer.MAX_VALUE), notification);
    promise.resolve(true);
  }

  @Override
  public boolean onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
    if (requestCode != POST_NOTIFICATIONS_REQUEST_CODE || permissionPromise == null) {
      return false;
    }

    boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
    permissionPromise.resolve(granted);
    permissionPromise = null;
    return true;
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return;
    }

    NotificationManager notificationManager =
        (NotificationManager) reactContext.getSystemService(Context.NOTIFICATION_SERVICE);

    if (notificationManager == null || notificationManager.getNotificationChannel(CHANNEL_ID) != null) {
      return;
    }

    NotificationChannel channel =
        new NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_DEFAULT);
    channel.setDescription("코인을 획득했을 때 표시되는 알림입니다.");
    notificationManager.createNotificationChannel(channel);
  }

  private int immutablePendingIntentFlag() {
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
  }
}
