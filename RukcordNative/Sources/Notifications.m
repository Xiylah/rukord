#import "Notifications.h"
#import <UIKit/UIKit.h>

// A small non-modal UIKit notice avoids depending on Discord's changing toast API.
void showRukcordNotification(NSString *message) {
    if (![message isKindOfClass:NSString.class] || message.length == 0) return;
    NSString *text = message.length > 240 ? [message substringToIndex:240] : message;
    dispatch_async(dispatch_get_main_queue(), ^{
        static UILabel *notice;
        static NSUInteger generation = 0;
        UIWindow *window = nil;
        for (UIWindow *candidate in UIApplication.sharedApplication.windows) {
            if (candidate.isKeyWindow) { window = candidate; break; }
        }
        if (!window) return;
        if (!notice) {
            notice = [UILabel new];
            notice.numberOfLines = 3;
            notice.textAlignment = NSTextAlignmentCenter;
            notice.font = [UIFont preferredFontForTextStyle:UIFontTextStyleSubheadline];
            notice.adjustsFontForContentSizeCategory = YES;
            notice.textColor = UIColor.whiteColor;
            notice.backgroundColor = [UIColor colorWithRed:0.16 green:0.11 blue:0.23 alpha:0.97];
            notice.layer.cornerRadius = 14;
            notice.clipsToBounds = YES;
            notice.userInteractionEnabled = NO;
            notice.autoresizingMask = UIViewAutoresizingFlexibleTopMargin | UIViewAutoresizingFlexibleLeftMargin | UIViewAutoresizingFlexibleRightMargin;
        }
        notice.text = text;
        CGFloat width = MIN(420, MAX(140, window.bounds.size.width - 40));
        CGSize fitted = [notice sizeThatFits:CGSizeMake(width - 28, 120)];
        CGFloat height = MIN(140, MAX(48, fitted.height + 24));
        notice.frame = CGRectMake((window.bounds.size.width - width) / 2,
            window.bounds.size.height - window.safeAreaInsets.bottom - height - 28, width, height);
        notice.alpha = 1;
        [window addSubview:notice];
        UIAccessibilityPostNotification(UIAccessibilityAnnouncementNotification, text);
        NSUInteger token = ++generation;
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 2 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
            if (token != generation) return;
            [notice removeFromSuperview];
        });
    });
}
