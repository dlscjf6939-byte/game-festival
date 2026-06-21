#import <React/RCTBridgeModule.h>
#import <UserNotifications/UserNotifications.h>

@interface LocalCoinNotificationModule : NSObject <RCTBridgeModule>
@end

@implementation LocalCoinNotificationModule

RCT_EXPORT_MODULE(LocalCoinNotification)

RCT_REMAP_METHOD(requestPermission,
                 requestPermissionWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  UNAuthorizationOptions options = UNAuthorizationOptionAlert | UNAuthorizationOptionBadge | UNAuthorizationOptionSound;

  [[UNUserNotificationCenter currentNotificationCenter] requestAuthorizationWithOptions:options completionHandler:^(BOOL granted, NSError * _Nullable error) {
    if (error) {
      reject(@"notification_permission_error", error.localizedDescription, error);
      return;
    }

    resolve(@(granted));
  }];
}

RCT_REMAP_METHOD(showCoinReward,
                 showCoinRewardWithOptions:(NSDictionary *)options
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  NSString *title = [options[@"title"] isKindOfClass:[NSString class]] ? options[@"title"] : @"코인 획득";
  NSString *body = [options[@"body"] isKindOfClass:[NSString class]] ? options[@"body"] : @"코인을 획득했어요.";

  UNMutableNotificationContent *content = [[UNMutableNotificationContent alloc] init];
  content.title = title;
  content.body = body;
  content.sound = [UNNotificationSound defaultSound];

  NSString *identifier = [NSString stringWithFormat:@"coin-reward-%@", @([[NSDate date] timeIntervalSince1970])];
  UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:identifier content:content trigger:nil];

  [[UNUserNotificationCenter currentNotificationCenter] addNotificationRequest:request withCompletionHandler:^(NSError * _Nullable error) {
    if (error) {
      reject(@"notification_show_error", error.localizedDescription, error);
      return;
    }

    resolve(@(YES));
  }];
}

@end
