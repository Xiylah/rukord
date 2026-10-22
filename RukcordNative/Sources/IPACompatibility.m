// Narrow sideload compatibility: keep identity queries made inside Discord
// compatible with its original identifier, and provide app-local shared storage.
// No entitlement, passkey, receipt, or security-scoped-resource overrides.
#import <Foundation/Foundation.h>
#import <objc/runtime.h>
#import <dlfcn.h>

static NSString *const OriginalIdentifier = @"com.hammerandchisel.discord";
static NSString *appPath;
static NSString *(*originalBundleIdentifier)(id, SEL);
static NSDictionary *(*originalInfoDictionary)(id, SEL);
static id (*originalInfoValue)(id, SEL, NSString *);
static NSURL *(*originalGroupURL)(id, SEL, NSString *);

static BOOL isDiscordCaller(void *address) {
    Dl_info info = {0};
    if (!dladdr(address, &info) || !info.dli_fname) return NO;
    NSString *path = [NSString stringWithUTF8String:info.dli_fname];
    return [path hasPrefix:[appPath stringByAppendingString:@"/"]];
}

static NSString *bundleIdentifier(id self, SEL selector) {
    if (self == NSBundle.mainBundle && isDiscordCaller(__builtin_return_address(0)))
        return OriginalIdentifier;
    return originalBundleIdentifier(self, selector);
}

static NSDictionary *infoDictionary(id self, SEL selector) {
    NSDictionary *original = originalInfoDictionary(self, selector);
    if (self != NSBundle.mainBundle || !isDiscordCaller(__builtin_return_address(0)))
        return original;
    NSMutableDictionary *copy = [original mutableCopy];
    copy[@"CFBundleIdentifier"] = OriginalIdentifier;
    return copy;
}

static id infoValue(id self, SEL selector, NSString *key) {
    if (self == NSBundle.mainBundle && [key isEqualToString:@"CFBundleIdentifier"] &&
        isDiscordCaller(__builtin_return_address(0))) return OriginalIdentifier;
    return originalInfoValue(self, selector, key);
}

static NSURL *groupURL(id self, SEL selector, NSString *identifier) {
    NSURL *original = originalGroupURL(self, selector, identifier);
    if (original) return original;
    NSString *prefix = @"group.com.hammerandchisel.discord";
    if (![identifier isEqualToString:prefix] &&
        ![identifier hasPrefix:[prefix stringByAppendingString:@"."]]) return nil;
    // A fallback directory is local to this app, not shared with removed extensions.
    NSURL *base = [[NSFileManager defaultManager] URLsForDirectory:NSApplicationSupportDirectory
        inDomains:NSUserDomainMask].firstObject;
    NSURL *folder = [[base URLByAppendingPathComponent:@"RukcordAppGroups" isDirectory:YES]
        URLByAppendingPathComponent:identifier.lastPathComponent isDirectory:YES];
    NSError *error = nil;
    if (![[NSFileManager defaultManager] createDirectoryAtURL:folder
        withIntermediateDirectories:YES attributes:nil error:&error]) return nil;
    return folder;
}

__attribute__((constructor)) static void initializeIPACompatibility(void) {
    @autoreleasepool {
        appPath = [NSBundle.mainBundle.bundlePath copy];
        Method method = class_getInstanceMethod(NSBundle.class, @selector(bundleIdentifier));
        originalBundleIdentifier = (void *)method_setImplementation(method, (IMP)bundleIdentifier);
        method = class_getInstanceMethod(NSBundle.class, @selector(infoDictionary));
        originalInfoDictionary = (void *)method_setImplementation(method, (IMP)infoDictionary);
        method = class_getInstanceMethod(NSBundle.class, @selector(objectForInfoDictionaryKey:));
        originalInfoValue = (void *)method_setImplementation(method, (IMP)infoValue);
        method = class_getInstanceMethod(NSFileManager.class,
            @selector(containerURLForSecurityApplicationGroupIdentifier:));
        originalGroupURL = (void *)method_setImplementation(method, (IMP)groupURL);
    }
}
