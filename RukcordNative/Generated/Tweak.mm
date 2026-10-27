#line 1 "Sources/Tweak.xm"
#import <Foundation/Foundation.h>
#import <MediaPlayer/MediaPlayer.h>
#import <UIKit/UIKit.h>
#import <jsi/jsi.h>
#import <functional>
#import <unistd.h>

#import "LoaderConfig.h"
#import "Logger.h"
#import "Utils.h"
#import "JSI.h"
#import "RCTHost.h"
#import "RCTInstance.h"
#import "Fonts.h"
#import "Settings.h"
#import "Notifications.h"

using namespace facebook;

static jsi::Runtime *gRuntime = NULL;
NSString *bunnyPatchesBundlePath;
static LoaderConfig  *loaderConfig;
static NSTimeInterval shakeStartTime = 0;
static BOOL           isShaking      = NO;

static NSURL *resolveDownloadURL(void)
{
    LoaderConfig *fresh = [LoaderConfig getLoaderConfig];
    if (fresh.customLoadUrlEnabled && fresh.customLoadUrl)
    {
        return fresh.customLoadUrl;
    }
    return [NSURL fileURLWithPath:[bunnyPatchesBundlePath stringByAppendingPathComponent:@"rukcord.js"]];
}

static dispatch_queue_t fsQueue(void)
{
    static dispatch_queue_t queue;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        queue = dispatch_queue_create("local.rukcord.fsQueue", DISPATCH_QUEUE_SERIAL);
    });
    return queue;
}

static BOOL looksLikeScript(NSData *data)
{
    if (!data.length) return NO;
    if (isHermesBytecode(data)) return data.length >= 32;
    NSString *text = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    NSString *trimmed = [text stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
    
    return trimmed.length > 0 && ![trimmed hasPrefix:@"<"] && ![trimmed hasPrefix:@"{"];
}

static void downloadBundleForNextLaunch(NSURL *rukcordDir)
{
    NSURL *bundleFileURL = [rukcordDir URLByAppendingPathComponent:@"bundle.js"];
    NSURL *targetURL = resolveDownloadURL();

    if (!targetURL || ![LoaderConfig getLoaderConfig].customLoadUrlEnabled) return;
    if (!targetURL.isFileURL && ![targetURL.scheme.lowercaseString isEqualToString:@"https"]) {
        BunnyLog(@"Rukcord: custom payloads require a local file or HTTPS");
        return;
    }
    
    if (targetURL.isFileURL) {
        NSData *data = [NSData dataWithContentsOfURL:targetURL];
        if (looksLikeScript(data)) {
            [data writeToURL:bundleFileURL atomically:YES];
        }
        return;
    }

    NSMutableURLRequest *req = [NSMutableURLRequest requestWithURL:targetURL
                                                       cachePolicy:NSURLRequestReloadIgnoringLocalAndRemoteCacheData
                                                   timeoutInterval:15.0];

    NSFileManager *fm = [NSFileManager defaultManager];
    NSURL *etagFileURL = [rukcordDir URLByAppendingPathComponent:@"etag.txt"];

    __block NSString *etag = nil;
    dispatch_sync(fsQueue(), ^{
        if ([fm fileExistsAtPath:bundleFileURL.path])
            etag = [NSString stringWithContentsOfURL:etagFileURL encoding:NSUTF8StringEncoding error:nil];
    });
    if (etag)
        [req setValue:etag forHTTPHeaderField:@"If-None-Match"];

    NSURLSession *session = [NSURLSession sessionWithConfiguration:[NSURLSessionConfiguration defaultSessionConfiguration]];
    [[session dataTaskWithRequest:req
                completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        if ([response isKindOfClass:[NSHTTPURLResponse class]])
        {
            NSHTTPURLResponse *http = (NSHTTPURLResponse *)response;
            if (http.statusCode == 200 && looksLikeScript(data)
                && ![http.MIMEType.lowercaseString isEqualToString:@"text/html"])
            {
                dispatch_sync(fsQueue(), ^{
                    if (![data writeToURL:bundleFileURL atomically:YES]) return;
                    NSString *newEtag = [http valueForHTTPHeaderField:@"Etag"];
                    if (newEtag)
                        [newEtag writeToURL:etagFileURL atomically:YES encoding:NSUTF8StringEncoding error:nil];
                    else
                        [fm removeItemAtURL:etagFileURL error:nil];
                });
            }
        }
        else if (error)
        {
            BunnyLog(@"downloadBundleForNextLaunch: Error: %@", error.localizedDescription);
        }
        [session finishTasksAndInvalidate];
    }] resume];
}

typedef id (^BridgeHandler)(NSArray *args);

static NSDictionary<NSString *, BridgeHandler> *bridgeHandlers(void)
{
    static NSDictionary<NSString *, BridgeHandler> *handlers;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        handlers = @{
            @"applemusic.get": ^id(NSArray *args) {
                MPMediaLibraryAuthorizationStatus authorization = [MPMediaLibrary authorizationStatus];

                switch (authorization) {
                    case MPMediaLibraryAuthorizationStatusNotDetermined:
                        return @{
                            @"authorization": @"notDetermined"
                        };
                    case MPMediaLibraryAuthorizationStatusDenied:
                        return @{
                            @"authorization": @"denied"
                        };
                    case MPMediaLibraryAuthorizationStatusRestricted:
                        return @{
                            @"authorization": @"restricted"
                        };
                    case MPMediaLibraryAuthorizationStatusAuthorized: {
                        MPMusicPlayerController *player = [MPMusicPlayerController systemMusicPlayer];
                        MPMediaItem *song = player.nowPlayingItem;

                        if (player.playbackState == MPMusicPlaybackStatePlaying && song) {
                            return @{
                                @"authorization": @"authorized",
                                @"playing": @YES,
                                @"song": @{
                                    @"title": song.title,
                                    @"artist": song.artist,
                                    @"album": song.albumTitle,
                                    @"duration": @{
                                        @"elapsed": @(player.currentPlaybackTime),
                                        @"total": @(song.playbackDuration)
                                    }
                                }
                            };
                        } else {
                            return @{
                                @"authorization": @"authorized",
                                @"playing": @NO
                            };
                        }
                    }
                }
            },

            @"applemusic.request": ^id(NSArray *args) {
                [MPMediaLibrary requestAuthorization:^(MPMediaLibraryAuthorizationStatus status) {}];
                return [NSNull null];
            },

            @"ui.toast": ^id(NSArray *args) {
                if (args.count > 0 && [args[0] isKindOfClass:NSString.class]) showRukcordNotification(args[0]);
                return [NSNull null];
            },

            @"updater.clear": ^id(NSArray *args) {
                if (![LoaderConfig getLoaderConfig].customLoadUrlEnabled) return [NSNull null];
                NSURL *rukcordDirectory = getRukcordDirectory();
                NSFileManager *fm = [NSFileManager defaultManager];
                [fm removeItemAtURL:[rukcordDirectory URLByAppendingPathComponent:@"bundle.js"] error:nil];
                [fm removeItemAtURL:[rukcordDirectory URLByAppendingPathComponent:@"etag.txt"] error:nil];
                BunnyLog(@"[Updater] Cache cleared via JSI bridge");
                return [NSNull null];
            },

            @"updater.download": ^id(NSArray *args) {
                BunnyLog(@"[Updater] updater.download JSI bridge method called");
                dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
                    NSURL *rukcordDirectory = getRukcordDirectory();
                    downloadBundleForNextLaunch(rukcordDirectory);
                });
                return [NSNull null];
            },

            @"updater.reload": ^id(NSArray *args) {
                
                dispatch_async(dispatch_get_main_queue(), ^{
                    UIWindow *w = [UIApplication sharedApplication].windows.firstObject;
                    if (w.rootViewController) reloadApp(w.rootViewController);
                });
                return [NSNull null];
            }
        };
    });
    return handlers;
}

static NSDictionary *callBridgeMethodHelper(NSString *methodName, NSArray *args)
{
    @try {
        BridgeHandler handler = bridgeHandlers()[methodName];
        if (!handler)
        {
            return @{@"error": [NSString stringWithFormat:@"Method not implemented: %@", methodName]};
        }

        __block id handlerResult;
        dispatch_sync(fsQueue(), ^{
            handlerResult = handler(args);
        });

        id responseVal = (handlerResult == nil) ? [NSNull null] : handlerResult;
        return @{@"result": responseVal};
    }
    @catch (NSException *exception) {
        return @{@"error": exception.reason ?: @"Unknown Objective-C exception"};
    }
}

static void injectPreBundle(jsi::Runtime &runtime)
{
    try
    {
        jsi::Object loaderObj(runtime);
        loaderObj.setProperty(runtime, "hasNativeToast", true);
        NSString *iconURL = [NSURL fileURLWithPath:[bunnyPatchesBundlePath stringByAppendingPathComponent:@"rukcord-icon.png"]].absoluteString;
        loaderObj.setProperty(runtime, "iconURL", jsi::String::createFromUtf8(runtime, iconURL.UTF8String));
        loaderObj.setProperty(runtime, "loaderName", jsi::String::createFromUtf8(runtime, "Rukcord"));
        loaderObj.setProperty(runtime, "loaderVersion", jsi::String::createFromUtf8(runtime, [PACKAGE_VERSION UTF8String]));
        loaderObj.setProperty(runtime, "hasThemeSupport", true);
        loaderObj.setProperty(runtime, "storedTheme", jsi::Value::null());
        loaderObj.setProperty(runtime, "fontPatch", 2);
        runtime.global().setProperty(runtime, "__RUKCORD_LOADER__", loaderObj);

        auto parsePayload = [](jsi::Runtime &rt, const jsi::Value *args, size_t count, NSString **methodOut, NSArray **argsOut) {
            if (count < 1 || !args[0].isObject()) {
                throw jsi::JSError(rt, "Expected a single payload object as argument.");
            }
            jsi::Object payload = args[0].asObject(rt);

            jsi::Value rukcordVal = payload.getProperty(rt, "rukcord");
            if (!rukcordVal.isObject()) throw jsi::JSError(rt, "Payload missing 'rukcord' object.");
            jsi::Object rukcord = rukcordVal.asObject(rt);

            jsi::Value methodVal = rukcord.getProperty(rt, "method");
            if (!methodVal.isString()) throw jsi::JSError(rt, "'method' property must be a string.");
            *methodOut = [JSI toNSString:methodVal runtime:rt];

            *argsOut = @[];
            jsi::Value argsVal = rukcord.getProperty(rt, "args");
            if (argsVal.isObject() && argsVal.asObject(rt).isArray(rt)) {
                *argsOut = [JSI toObjC:argsVal runtime:rt];
            }
        };

        auto syncCall = jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forUtf8(runtime, "__RUKCORD_BRIDGE_CALL_SYNC__"),
            1,
            [parsePayload](jsi::Runtime &rt, const jsi::Value &thisVal, const jsi::Value *args, size_t count) -> jsi::Value {
                NSString *methodName;
                NSArray *objcArgs;
                parsePayload(rt, args, count, &methodName, &objcArgs);

                NSDictionary *res = callBridgeMethodHelper(methodName, objcArgs);
                return [JSI fromObjC:res runtime:rt];
            }
        );
        runtime.global().setProperty(runtime, "__RUKCORD_BRIDGE_CALL_SYNC__", syncCall);

        auto asyncCall = jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forUtf8(runtime, "__RUKCORD_BRIDGE_CALL_ASYNC__"),
            1,
            [parsePayload](jsi::Runtime &rt, const jsi::Value &thisVal, const jsi::Value *args, size_t count) -> jsi::Value {
                NSString *methodName;
                NSArray *objcArgs;
                parsePayload(rt, args, count, &methodName, &objcArgs);

                jsi::Function promiseCtor = rt.global().getPropertyAsFunction(rt, "Promise");
                jsi::Function executor = jsi::Function::createFromHostFunction(rt, jsi::PropNameID::forUtf8(rt, "executor"), 2,
                    [methodName, objcArgs](jsi::Runtime &innerRt, const jsi::Value &thisVal, const jsi::Value *innerArgs, size_t innerCount) -> jsi::Value {
                        jsi::Function resolve = innerArgs[0].asObject(innerRt).asFunction(innerRt);
                        NSDictionary *res = callBridgeMethodHelper(methodName, objcArgs);
                        resolve.call(innerRt, [JSI fromObjC:res runtime:innerRt]);
                        return jsi::Value::undefined();
                    });
                return promiseCtor.callAsConstructor(rt, executor);
            }
        );
        runtime.global().setProperty(runtime, "__RUKCORD_BRIDGE_CALL_ASYNC__", asyncCall);

    }
    catch (const jsi::JSError &e) { BunnyLog(@"injectPreBundle: JSError: %s", e.what()); }
    catch (const std::exception &e) { BunnyLog(@"injectPreBundle: exception: %s", e.what()); }
}

static void executePreloads(jsi::Runtime &runtime, NSURL *rukcordDir)
{
    NSURL *preloadsDirectory = [rukcordDir URLByAppendingPathComponent:@"preloads"];
    if ([[NSFileManager defaultManager] fileExistsAtPath:preloadsDirectory.path])
    {
        NSArray *contents = [[NSFileManager defaultManager] contentsOfDirectoryAtURL:preloadsDirectory
                                                           includingPropertiesForKeys:nil options:0 error:nil];
        for (NSURL *fileURL in contents)
        {
            if ([[fileURL pathExtension] isEqualToString:@"js"])
            {
                NSData *data = [NSData dataWithContentsOfURL:fileURL];
                if (data) [JSI evaluate:data tag:@"rukcord:preload" runtime:runtime];
            }
        }
    }
}


#include <objc/message.h>
#if defined(__clang__)
#if __has_feature(objc_arc)
#define _LOGOS_SELF_TYPE_NORMAL __unsafe_unretained
#define _LOGOS_SELF_TYPE_INIT __attribute__((ns_consumed))
#define _LOGOS_SELF_CONST const
#define _LOGOS_RETURN_RETAINED __attribute__((ns_returns_retained))
#else
#define _LOGOS_SELF_TYPE_NORMAL
#define _LOGOS_SELF_TYPE_INIT
#define _LOGOS_SELF_CONST
#define _LOGOS_RETURN_RETAINED
#endif
#else
#define _LOGOS_SELF_TYPE_NORMAL
#define _LOGOS_SELF_TYPE_INIT
#define _LOGOS_SELF_CONST
#define _LOGOS_RETURN_RETAINED
#endif

__attribute__((unused)) static void _logos_register_hook(Class _class, SEL _cmd, IMP _new, IMP *_old) {
unsigned int _count, _i;
Class _searchedClass = _class;
Method *_methods;
while (_searchedClass) {
_methods = class_copyMethodList(_searchedClass, &_count);
for (_i = 0; _i < _count; _i++) {
if (method_getName(_methods[_i]) == _cmd) {
if (_class == _searchedClass) {
*_old = method_setImplementation(_methods[_i], _new);
} else {
*_old = method_getImplementation(_methods[_i]);
class_addMethod(_class, _cmd, _new, method_getTypeEncoding(_methods[_i]));
}
free(_methods);
return;
}
}
free(_methods);
_searchedClass = class_getSuperclass(_searchedClass);
}
}
@class RCTHost; @class UIWindow; 
static Class _logos_superclass$_ungrouped$RCTHost; static void (*_logos_orig$_ungrouped$RCTHost$instance$didInitializeRuntime$)(_LOGOS_SELF_TYPE_NORMAL RCTHost* _LOGOS_SELF_CONST, SEL, id, facebook::jsi::Runtime &);static Class _logos_superclass$_ungrouped$UIWindow; static void (*_logos_orig$_ungrouped$UIWindow$motionBegan$withEvent$)(_LOGOS_SELF_TYPE_NORMAL UIWindow* _LOGOS_SELF_CONST, SEL, UIEventSubtype, UIEvent *);static void (*_logos_orig$_ungrouped$UIWindow$motionEnded$withEvent$)(_LOGOS_SELF_TYPE_NORMAL UIWindow* _LOGOS_SELF_CONST, SEL, UIEventSubtype, UIEvent *);

#line 320 "Sources/Tweak.xm"



static void _logos_method$_ungrouped$RCTHost$instance$didInitializeRuntime$(_LOGOS_SELF_TYPE_NORMAL RCTHost* _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, id instance, facebook::jsi::Runtime & runtime)
 {
    gRuntime = &runtime;
    _logos_orig$_ungrouped$RCTHost$instance$didInitializeRuntime$(self, _cmd, instance, runtime);

    [loaderConfig loadConfig];
    NSURL *rukcordDir = getRukcordDirectory();
    injectPreBundle(runtime);

    
    
    NSURL *bundleFileURL = loaderConfig.customLoadUrlEnabled
        ? [rukcordDir URLByAppendingPathComponent:@"bundle.js"]
        : [NSURL fileURLWithPath:[bunnyPatchesBundlePath stringByAppendingPathComponent:@"rukcord.js"]];
    NSData *bundle = [NSData dataWithContentsOfURL:bundleFileURL];

    if (bundle && bundle.length > 0)
    {
        [JSI evaluate:bundle tag:@"rukcord:bundle" runtime:runtime];
        executePreloads(runtime, rukcordDir);
    }
    else
    {
        if (loaderConfig.customLoadUrlEnabled) downloadBundleForNextLaunch(rukcordDir);
        else BunnyLog(@"Rukcord: packaged rukcord.js missing; leaving Discord unmodified");
    }
}






static void _logos_method$_ungrouped$UIWindow$motionBegan$withEvent$(_LOGOS_SELF_TYPE_NORMAL UIWindow* _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, UIEventSubtype motion, UIEvent * event)
 {
    if (motion == UIEventSubtypeMotionShake)
    {
        isShaking      = YES;
        shakeStartTime = [[NSDate date] timeIntervalSince1970];
    }
    _logos_orig$_ungrouped$UIWindow$motionBegan$withEvent$(self, _cmd, motion, event);
}


static void _logos_method$_ungrouped$UIWindow$motionEnded$withEvent$(_LOGOS_SELF_TYPE_NORMAL UIWindow* _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, UIEventSubtype motion, UIEvent * event)
 {
    if (motion == UIEventSubtypeMotionShake && isShaking)
    {
        NSTimeInterval shakeDuration = [[NSDate date] timeIntervalSince1970] - shakeStartTime;
        if (shakeDuration >= 0.5 && shakeDuration <= 2.0)
            dispatch_async(dispatch_get_main_queue(), ^{ showSettingsSheet(); });
        isShaking = NO;
    }
    _logos_orig$_ungrouped$UIWindow$motionEnded$withEvent$(self, _cmd, motion, event);
}



static __attribute__((constructor)) void _logosLocalCtor_819282d5(int __unused argc, char __unused **argv, char __unused **envp)
{
    @autoreleasepool
    {
        BOOL newArchEnabled = YES;
        @try {
            id rawVal = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"RCTNewArchEnabled"];
            if (rawVal) newArchEnabled = [rawVal boolValue];
        }
        @catch (...) {
        }

        if (!newArchEnabled)
        {
            dispatch_async(dispatch_get_main_queue(), ^{
                showErrorAlert(@"Incompatible Discord Version",
                              @"This version of Discord is not using bridgeless "
                              @"Please update Discord to v332 or above",
                              nil);
            });
            return;
        }

#if RUKCORD_IPA
        isJailbroken = NO;
        bunnyPatchesBundlePath = [NSBundle.mainBundle.bundlePath stringByAppendingPathComponent:@"RukcordResources.bundle"];
#else
        NSString *install_prefix = @"/var/jb";
        isJailbroken = [[NSFileManager defaultManager] fileExistsAtPath:install_prefix];
        BOOL jbPathExists = isJailbroken;

        NSString *bundlePath = [NSString stringWithFormat:@"%@/Library/Application Support/RukcordResources.bundle", install_prefix];
        NSString *jailedPath = [[NSBundle mainBundle].bundleURL.path stringByAppendingPathComponent:@"RukcordResources.bundle"];

        if (jbPathExists && [[NSFileManager defaultManager] fileExistsAtPath:bundlePath]) {
            bunnyPatchesBundlePath = bundlePath;
        } else {
            bunnyPatchesBundlePath = jailedPath;
        }
#endif

        loaderConfig = [[LoaderConfig alloc] init];
        [loaderConfig loadConfig];

        {Class _logos_class$_ungrouped$RCTHost = objc_getClass("RCTHost"); _logos_superclass$_ungrouped$RCTHost = class_getSuperclass(_logos_class$_ungrouped$RCTHost); { _logos_register_hook(_logos_class$_ungrouped$RCTHost, @selector(instance:didInitializeRuntime:), (IMP)&_logos_method$_ungrouped$RCTHost$instance$didInitializeRuntime$, (IMP *)&_logos_orig$_ungrouped$RCTHost$instance$didInitializeRuntime$);}Class _logos_class$_ungrouped$UIWindow = objc_getClass("UIWindow"); _logos_superclass$_ungrouped$UIWindow = class_getSuperclass(_logos_class$_ungrouped$UIWindow); { _logos_register_hook(_logos_class$_ungrouped$UIWindow, @selector(motionBegan:withEvent:), (IMP)&_logos_method$_ungrouped$UIWindow$motionBegan$withEvent$, (IMP *)&_logos_orig$_ungrouped$UIWindow$motionBegan$withEvent$);}{ _logos_register_hook(_logos_class$_ungrouped$UIWindow, @selector(motionEnded:withEvent:), (IMP)&_logos_method$_ungrouped$UIWindow$motionEnded$withEvent$, (IMP *)&_logos_orig$_ungrouped$UIWindow$motionEnded$withEvent$);}}
    }
}
