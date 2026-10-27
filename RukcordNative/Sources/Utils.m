#import "Utils.h"
#import "LoaderConfig.h"
#import "Logger.h"
#import <objc/message.h>
#import <spawn.h>
#import <sys/utsname.h>
#import <dlfcn.h>

BOOL isJailbroken = NO;

NSURL *getRukcordDirectory(void) {
    BunnyLog(@"getRukcordDirectory: start");
    NSFileManager *fileManager  = [NSFileManager defaultManager];
    BunnyLog(@"getRukcordDirectory: got fileManager");
    NSURL *documentDirectoryURL = [[fileManager URLsForDirectory:NSDocumentDirectory
                                                   inDomains:NSUserDomainMask] lastObject];
    BunnyLog(@"getRukcordDirectory: documentDirectoryURL = %@", documentDirectoryURL);

    NSURL *rukcordFolderURL = [documentDirectoryURL URLByAppendingPathComponent:@"rukcord"];
    BunnyLog(@"getRukcordDirectory: rukcordFolderURL = %@", rukcordFolderURL);

    if (![fileManager fileExistsAtPath:rukcordFolderURL.path]) {
        BunnyLog(@"getRukcordDirectory: creating directory...");
        [fileManager createDirectoryAtURL:rukcordFolderURL
                  withIntermediateDirectories:YES
                                   attributes:nil
                                       error:nil];
        BunnyLog(@"getRukcordDirectory: directory created");
    }

    BunnyLog(@"getRukcordDirectory: returning %@", rukcordFolderURL);
    return rukcordFolderURL;
}

UIColor *hexToUIColor(NSString *hex) {
    if (![hex hasPrefix:@"#"]) {
        return nil;
    }

    NSString *hexColor = [hex substringFromIndex:1];
    if (hexColor.length == 6) {
        hexColor = [hexColor stringByAppendingString:@"ff"];
    }

    if (hexColor.length == 8) {
        unsigned int hexNumber;
        NSScanner *scanner = [NSScanner scannerWithString:hexColor];
        if ([scanner scanHexInt:&hexNumber]) {
            CGFloat r = ((hexNumber & 0xFF000000) >> 24) / 255.0;
            CGFloat g = ((hexNumber & 0x00FF0000) >> 16) / 255.0;
            CGFloat b = ((hexNumber & 0x0000FF00) >> 8) / 255.0;
            CGFloat a = (hexNumber & 0x000000FF) / 255.0;

            return [UIColor colorWithRed:r green:g blue:b alpha:a];
        }
    }

    return nil;
}

void showErrorAlert(NSString *title, NSString *message, void (^completion)(void)) {
    dispatch_async(dispatch_get_main_queue(), ^{
        UIAlertController *alert =
            [UIAlertController alertControllerWithTitle:title
                                                message:message
                                         preferredStyle:UIAlertControllerStyleAlert];

        UIAlertAction *okAction = [UIAlertAction actionWithTitle:@"OK"
                                                           style:UIAlertActionStyleDefault
                                                         handler:^(UIAlertAction *action) {
                                                             if (completion) {
                                                                 completion();
                                                             }
                                                         }];

        [alert addAction:okAction];

        UIWindow *window = nil;
        NSArray *windows = [[UIApplication sharedApplication] windows];
        for (UIWindow *w in windows) {
            if (w.isKeyWindow) {
                window = w;
                break;
            }
        }

        [window.rootViewController presentViewController:alert animated:YES completion:nil];
    });
}

NSString *getDeviceIdentifier(void) {
    struct utsname systemInfo;
    uname(&systemInfo);
    return [NSString stringWithCString:systemInfo.machine encoding:NSUTF8StringEncoding];
}

void reloadApp(UIViewController *viewController) {
    void (^closeApp)(void) = ^{
        UIApplication *app = [UIApplication sharedApplication];
        ((void (*)(id, SEL))objc_msgSend)(app, @selector(suspend));
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 0.5 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{ exit(0); });
    };
    if (viewController.presentedViewController) {
        [viewController dismissViewControllerAnimated:NO completion:closeApp];
    } else {
        closeApp();
    }
}

void loadCustomBundleFromURL(NSURL *url, UIViewController *viewController) {
    LoaderConfig *config        = [LoaderConfig getLoaderConfig];
    config.customLoadUrlEnabled = YES;
    config.customLoadUrl        = url;
    if ([config saveConfig]) {
        reloadApp(viewController);
    } else {
        showErrorAlert(@"Error", @"Failed to save custom bundle configuration", nil);
    }
}

void deletePlugins(void) {
    [[NSFileManager defaultManager]
        removeItemAtURL:[getRukcordDirectory() URLByAppendingPathComponent:@"plugins"]
                  error:nil];
}

void deleteThemes(void) {
    [[NSFileManager defaultManager]
        removeItemAtURL:[getRukcordDirectory() URLByAppendingPathComponent:@"themes"]
                  error:nil];
}

void deleteAllData(UIViewController *presenter) {
    [[NSFileManager defaultManager] removeItemAtURL:getRukcordDirectory() error:nil];
    gracefulExit(presenter);
}

void gracefulExit(UIViewController *presenter) {
    UIApplication *app = [UIApplication sharedApplication];
    [app performSelector:@selector(suspend)];

    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 0.5 * NSEC_PER_SEC), dispatch_get_main_queue(),
                   ^{ [app performSelector:@selector(terminateWithSuccess)]; });
}

void setCustomBundleURL(NSURL *url, UIViewController *presenter) {
    LoaderConfig *config        = [LoaderConfig getLoaderConfig];
    config.customLoadUrlEnabled = YES;
    config.customLoadUrl        = url;
    [config saveConfig];
    removeCachedBundle();
    gracefulExit(presenter);
}

void resetCustomBundleURL(UIViewController *presenter) {
    LoaderConfig *config        = [LoaderConfig getLoaderConfig];
    config.customLoadUrlEnabled = NO;
    config.customLoadUrl        = [NSURL URLWithString:@"http://localhost:4040/rukcord.js"];
    [config saveConfig];
    removeCachedBundle();
    gracefulExit(presenter);
}

// The JS store is Zustand-persist JSON: {state: {..., safeMode: bool}, version: 0}.
// Recovery must use the same isolated path and preserve every unrelated setting.
BOOL isSafeModeEnabled(void) {
    NSURL *url = [getRukcordDirectory() URLByAppendingPathComponent:@"settings.json"];
    NSData *data = [NSData dataWithContentsOfURL:url];
    if (!data) return NO;
    id root = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    if (![root isKindOfClass:NSDictionary.class]) return NO;
    id state = root[@"state"];
    if (![state isKindOfClass:NSDictionary.class]) return NO;
    id flag = state[@"safeMode"];
    return [flag isKindOfClass:NSNumber.class] && [flag boolValue];
}

void toggleSafeMode(void) {
    NSURL *url = [getRukcordDirectory() URLByAppendingPathComponent:@"settings.json"];
    NSData *data = [NSData dataWithContentsOfURL:url];
    id parsed = data ? [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingMutableContainers error:nil] : nil;
    if (data && (![parsed isKindOfClass:NSDictionary.class] ||
                 ![parsed[@"state"] isKindOfClass:NSDictionary.class])) {
        BunnyLog(@"Rukcord: malformed settings; refusing to overwrite them");
        return;
    }
    NSMutableDictionary *root = parsed ? [parsed mutableCopy] : [@{@"state": @{}, @"version": @0} mutableCopy];
    NSMutableDictionary *state = [root[@"state"] mutableCopy];
    id old = state[@"safeMode"];
    state[@"safeMode"] = @(!([old isKindOfClass:NSNumber.class] && [old boolValue]));
    root[@"state"] = state;
    NSData *json = [NSJSONSerialization dataWithJSONObject:root options:0 error:nil];
    if (!json || ![json writeToURL:url atomically:YES]) {
        BunnyLog(@"Rukcord: failed to save safe mode");
        return;
    }
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 0.4 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
        UIViewController *vc = [UIApplication sharedApplication].windows.firstObject.rootViewController;
        reloadApp(vc);
    });
}

void showBundleSelector(UIViewController *presenter) {
    // Rukcord is distributed as a local pinned package.
    (void)presenter;
}

NSURL *getBundleBackupURL(void) {
    return [getRukcordDirectory() URLByAppendingPathComponent:@"bundle.js.backup"];
}

void moveCachedBundleToBackup(void) {
    NSFileManager *fm = [NSFileManager defaultManager];
    NSURL *bundleURL = [getRukcordDirectory() URLByAppendingPathComponent:@"bundle.js"];
    NSURL *backupURL = getBundleBackupURL();

    if ([fm fileExistsAtPath:backupURL.path]) {
        NSError *removeError = nil;
        [fm removeItemAtURL:backupURL error:&removeError];
        if (removeError) {
            BunnyLog(@"Failed to remove old backup: %@", removeError);
        }
    }

    if ([fm fileExistsAtPath:bundleURL.path]) {
        NSError *moveError = nil;
        [fm moveItemAtURL:bundleURL toURL:backupURL error:&moveError];
        if (moveError) {
            BunnyLog(@"Failed to create bundle backup: %@", moveError);
        } else {
            BunnyLog(@"Successfully moved bundle to backup");
        }
    } else {
        BunnyLog(@"No cached bundle to backup");
    }
}

BOOL restoreBundleFromBackup(void) {
    NSFileManager *fm = [NSFileManager defaultManager];
    NSURL *bundleURL = [getRukcordDirectory() URLByAppendingPathComponent:@"bundle.js"];
    NSURL *backupURL = getBundleBackupURL();

    if ([fm fileExistsAtPath:backupURL.path]) {
        if ([fm fileExistsAtPath:bundleURL.path]) {
            [fm removeItemAtURL:bundleURL error:nil];
        }

        NSError *error = nil;
        [fm moveItemAtURL:backupURL toURL:bundleURL error:&error];
        if (error) {
            BunnyLog(@"Failed to restore bundle from backup: %@", error);
            return NO;
        }
        BunnyLog(@"Successfully restored bundle from backup");
        return YES;
    }

    BunnyLog(@"No backup bundle found to restore");
    return NO;
}

void cleanupBundleBackup(void) {
    NSFileManager *fm = [NSFileManager defaultManager];
    NSURL *backupURL = getBundleBackupURL();

    if ([fm fileExistsAtPath:backupURL.path]) {
        NSError *error = nil;
        [fm removeItemAtURL:backupURL error:&error];
        if (error) {
            BunnyLog(@"Failed to cleanup backup: %@", error);
        } else {
            BunnyLog(@"Cleaned up bundle backup");
        }
    }
}


void deletePluginsAndReload(UIViewController *presenter) {
    deletePlugins();
    reloadApp(presenter);
}

void deleteThemesAndReload(UIViewController *presenter) {
    deleteThemes();
    reloadApp(presenter);
}

void refetchBundle(UIViewController *presenter) {
    moveCachedBundleToBackup();
    reloadApp(presenter);
}

void removeCachedBundle(void) {
    NSError *error = nil;
    [[NSFileManager defaultManager]
        removeItemAtURL:[getRukcordDirectory() URLByAppendingPathComponent:@"bundle.js"]
                  error:&error];
    if (error) {
        BunnyLog(@"Failed to remove cached bundle: %@", error);
    }
}

BOOL isRNNewArchEnabled(void) {
    BunnyLog(@"isRNNewArchEnabled: start");
    id raw = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"RCTNewArchEnabled"];
    BunnyLog(@"isRNNewArchEnabled: raw = %@", raw);
    if (raw) {
        return [raw boolValue];
    }
    BunnyLog(@"isRNNewArchEnabled: assuming YES (bridgeless)");
    return YES;
}

BOOL isHermesBytecode(NSData *data) {
    if (!data || data.length < 4) {
        return NO;
    }
    const uint8_t *bytes = (const uint8_t *)data.bytes;
    if (bytes[0] == 0xC6 && bytes[1] == 0x1F && bytes[2] == 0xBC && bytes[3] == 0x03) {
        return YES;
    }

    if (bytes[0] > 0x7F) {
        for (int i = 0; i < 4 && i < (int)data.length; i++) {
            if (bytes[i] == 0x00) return YES;
        }
    }
    return NO;
}
