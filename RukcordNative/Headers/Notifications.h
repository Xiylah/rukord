#pragma once
#import <Foundation/Foundation.h>

// Implemented in Objective-C (.m), also called from Objective-C++ (.mm).
#ifdef __cplusplus
extern "C" {
#endif
void showRukcordNotification(NSString *message);
#ifdef __cplusplus
}
#endif
