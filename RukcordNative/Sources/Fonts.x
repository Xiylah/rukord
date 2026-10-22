#import <CoreFoundation/CoreFoundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <CoreText/CoreText.h>
#import <objc/runtime.h>

#import "Fonts.h"
#import "FontPolicy.h"
#import "Logger.h"
#import "Utils.h"

NSMutableDictionary<NSString *, NSString *> *fontMap;

// Match Discord text families only. Explicit icon/emoji and picker-preview
// families keep their own font descriptors and fallback cascades.
static NSString *RukcordReplacementForFont(NSString *name, UIFontDescriptor *descriptor) {
    if (!fontMap.count || ![name isKindOfClass:[NSString class]]) return nil;
    NSString *compact = [[[name lowercaseString] stringByReplacingOccurrencesOfString:@" " withString:@""] stringByReplacingOccurrencesOfString:@"-" withString:@""];
    BOOL discordFamily = [compact hasPrefix:@"ggsans"] || [compact hasPrefix:@"notosans"] || [compact hasPrefix:@"abcginto"];
    if (discordFamily && fontMap[@"systemFont"]) {
        UIFontDescriptorSymbolicTraits traits = descriptor.symbolicTraits;
        NSDictionary *fontTraits = [descriptor objectForKey:UIFontDescriptorTraitsAttribute];
        CGFloat weight = RukcordNormalizeWeight([fontTraits[UIFontWeightTrait] doubleValue]);
        BOOL italic = (traits & UIFontDescriptorTraitItalic) || [compact containsString:@"italic"];
        BOOL bold = (traits & UIFontDescriptorTraitBold) || weight >= UIFontWeightSemibold || [compact containsString:@"bold"] || [compact containsString:@"black"];
        NSString *key = italic ? (bold ? @"systemFontBoldItalic" : @"systemFontItalic") : bold ? @"systemFontBold" : (weight >= UIFontWeightMedium || [compact containsString:@"medium"]) ? @"systemFontMedium" : @"systemFont";
        return fontMap[key] ?: fontMap[@"systemFont"];
    }
    return fontMap[name];
}

static NSString *RukcordKeyForRole(RukcordFontRole role) {
    switch (role) {
        case RukcordFontMedium: return @"systemFontMedium";
        case RukcordFontBold: return @"systemFontBold";
        case RukcordFontItalic: return @"systemFontItalic";
        case RukcordFontBoldItalic: return @"systemFontBoldItalic";
        default: return @"systemFont";
    }
}
static UIFont *RukcordSystemFont(UIFont *original, CGFloat weight, BOOL italic, BOOL inheritTraits) {
    if (!original || !fontMap[@"systemFont"]) return original;
    UIFontDescriptorSymbolicTraits traits = inheritTraits ? original.fontDescriptor.symbolicTraits : 0;
    RukcordFontRole role = RukcordChooseFontRole(weight, (traits & UIFontDescriptorTraitBold) != 0, italic || (traits & UIFontDescriptorTraitItalic));
    NSString *name = fontMap[RukcordKeyForRole(role)] ?: fontMap[@"systemFont"];
    UIFontDescriptor *descriptor = [[UIFontDescriptor fontDescriptorWithName:name size:original.pointSize] fontDescriptorByAddingAttributes:@{UIFontDescriptorCascadeListAttribute: @[original.fontDescriptor]}];
    return [UIFont fontWithDescriptor:descriptor size:original.pointSize] ?: original;
}

static UIFont *RukcordMessageFont(UIFont *font) {
    if (![font isKindOfClass:[UIFont class]] || !fontMap.count) return font;
    NSString *replacement = RukcordReplacementForFont(font.fontName, font.fontDescriptor);
    if (!replacement && fontMap[@"systemFont"] && [font.fontName hasPrefix:@".SF"]) {
        NSDictionary *traits = [font.fontDescriptor objectForKey:UIFontDescriptorTraitsAttribute];
        return RukcordSystemFont(font, RukcordNormalizeWeight([traits[UIFontWeightTrait] doubleValue]), NO, YES);
    }
    if (!replacement) return font;
    UIFontDescriptor *descriptor = [[UIFontDescriptor fontDescriptorWithName:replacement size:font.pointSize] fontDescriptorByAddingAttributes:@{UIFontDescriptorCascadeListAttribute: @[font.fontDescriptor]}];
    return [UIFont fontWithDescriptor:descriptor size:font.pointSize] ?: font;
}
static NSDictionary *RukcordTypingAttributes(NSDictionary *attributes) {
    if (![attributes isKindOfClass:[NSDictionary class]] || !fontMap.count) return attributes;
    UIFont *original = attributes[NSFontAttributeName];
    UIFont *replacement = RukcordMessageFont(original);
    if (original == replacement) return attributes;
    NSMutableDictionary *copy = [attributes mutableCopy];
    copy[NSFontAttributeName] = replacement;
    return copy;
}
static NSAttributedString *RukcordMessageText(NSAttributedString *text) {
    if (![text isKindOfClass:[NSAttributedString class]] || !fontMap.count || !text.length) return text;
    __block NSMutableAttributedString *copy = nil;
    [text enumerateAttribute:NSFontAttributeName inRange:NSMakeRange(0, text.length) options:0 usingBlock:^(id value, NSRange range, BOOL *stop) {
        UIFont *replacement = RukcordMessageFont(value);
        if (replacement != value) {
            if (!copy) copy = [text mutableCopy];
            [copy addAttribute:NSFontAttributeName value:replacement range:range];
        }
    }];
    return copy ?: text;
}
static BOOL RukcordFontMethodMatches(Class cls, SEL selector, BOOL classMethod, char returnType, unsigned arguments) {
    Method method = classMethod ? class_getClassMethod(cls, selector) : class_getInstanceMethod(cls, selector);
    if (!method || method_getNumberOfArguments(method) != arguments) return NO;
    char *type = method_copyReturnType(method);
    BOOL matches = type && type[0] == returnType;
    free(type);
    return matches;
}

%hook UIFont
+ (UIFont *)fontWithName:(NSString *)name size:(CGFloat)size {
    NSString *replacementName = RukcordReplacementForFont(name, nil);
    if (replacementName) {
        UIFontDescriptor *fallback = [UIFontDescriptor fontDescriptorWithName:name size:size];
        UIFontDescriptor *descriptor = [[UIFontDescriptor fontDescriptorWithName:replacementName size:size] fontDescriptorByAddingAttributes:@{UIFontDescriptorCascadeListAttribute: @[fallback]}];
        return [UIFont fontWithDescriptor:descriptor size:size];
    }
    return %orig;
}
+ (UIFont *)fontWithDescriptor:(UIFontDescriptor *)descriptor size:(CGFloat)size {
    NSString *replacementName = RukcordReplacementForFont(descriptor.postscriptName, descriptor);
    if (replacementName) {
        UIFontDescriptor *replacement = [[UIFontDescriptor fontDescriptorWithName:replacementName size:size] fontDescriptorByAddingAttributes:@{UIFontDescriptorCascadeListAttribute: @[descriptor]}];
        // Call the original implementation: avoid recursively invoking this hook.
        return %orig(replacement, size);
    }
    return %orig;
}
+ (UIFont *)systemFontOfSize:(CGFloat)size {
    UIFont *original = %orig;
    return RukcordSystemFont(original, UIFontWeightRegular, NO, NO);
}
+ (UIFont *)systemFontOfSize:(CGFloat)size weight:(CGFloat)weight {
    UIFont *original = %orig;
    return RukcordSystemFont(original, weight, NO, NO);
}
+ (UIFont *)boldSystemFontOfSize:(CGFloat)size {
    UIFont *original = %orig;
    return RukcordSystemFont(original, UIFontWeightBold, NO, NO);
}
+ (UIFont *)italicSystemFontOfSize:(CGFloat)size {
    UIFont *original = %orig;
    return RukcordSystemFont(original, UIFontWeightRegular, YES, NO);
}
+ (UIFont *)preferredFontForTextStyle:(UIFontTextStyle)style {
    // Preserve the original Dynamic Type point size rather than systemFontSize.
    UIFont *original = %orig;
    return RukcordSystemFont(original, UIFontWeightRegular, NO, YES);
}
+ (UIFont *)preferredFontForTextStyle:(UIFontTextStyle)style compatibleWithTraitCollection:(UITraitCollection *)collection {
    UIFont *original = %orig;
    return RukcordSystemFont(original, UIFontWeightRegular, NO, YES);
}
%end

// Discord 349 metadata confirms these object-returning/void selectors. Hook
// groups are enabled only when the runtime signatures also match.
%group RukcordNativeMessageFont
%hook DCDAttributedStringGenerator
+ (id)font:(id)font withOptions:(id)options {
    id result = %orig;
    return RukcordMessageFont(result);
}
%end
%end
%group RukcordNativeAttributedText
%hook DCDAttributedTextView
- (void)setAttributedText:(NSAttributedString *)text {
    NSAttributedString *replacement = RukcordMessageText(text);
    %orig(replacement);
}
%end
%end

%hook UITextView
- (void)setFont:(UIFont *)font {
    UIFont *replacement = RukcordMessageFont(font);
    %orig(replacement);
}
- (void)setAttributedText:(NSAttributedString *)text {
    NSAttributedString *replacement = RukcordMessageText(text);
    %orig(replacement);
}
- (void)setTypingAttributes:(NSDictionary *)attributes {
    NSDictionary *replacement = RukcordTypingAttributes(attributes);
    %orig(replacement);
}
%end
%hook UITextField
- (void)setFont:(UIFont *)font {
    UIFont *replacement = RukcordMessageFont(font);
    %orig(replacement);
}
- (void)setAttributedText:(NSAttributedString *)text {
    NSAttributedString *replacement = RukcordMessageText(text);
    %orig(replacement);
}
- (void)setDefaultTextAttributes:(NSDictionary *)attributes {
    NSDictionary *replacement = RukcordTypingAttributes(attributes);
    %orig(replacement);
}
%end

void patchFonts(NSDictionary<NSString *, NSString *> *mainFonts, NSString *fontDefName)
{
    BunnyLog(@"patchFonts called with fonts: %@ and def name: %@", mainFonts, fontDefName);

    if (!fontMap)
    {
        BunnyLog(@"Creating new fontMap");
        fontMap = [NSMutableDictionary dictionary];
    }

    NSString *fontJson = [NSString
        stringWithContentsOfURL:[getRukcordDirectory() URLByAppendingPathComponent:@"fonts.json"]
                       encoding:NSUTF8StringEncoding
                          error:nil];
    if (fontJson)
    {
        BunnyLog(@"Found existing fonts.json: %@", fontJson);
    }

    if (![mainFonts isKindOfClass:[NSDictionary class]] || ![fontDefName isKindOfClass:[NSString class]]) return;
    for (NSString *fontName in mainFonts)
    {
        NSString *url = mainFonts[fontName];
        if (![url isKindOfClass:[NSString class]]) continue;
        if ([url hasPrefix:@"system:"])
        {
            NSString *installedName = [url substringFromIndex:7];
            NSSet *allowed = [NSSet setWithArray:@[ @"AvenirNext-Regular", @"AvenirNext-Medium", @"AvenirNext-Bold", @"AvenirNext-Italic", @"AvenirNext-BoldItalic", @"Georgia", @"Georgia-Bold", @"Georgia-Italic", @"Georgia-BoldItalic", @"Menlo-Regular", @"Menlo-Bold", @"Menlo-Italic", @"Menlo-BoldItalic" ]];
            if ([allowed containsObject:installedName] && [UIFont fontWithName:installedName size:14])
                fontMap[fontName] = installedName;
            continue;
        }
        BunnyLog(@"Replacing font %@ with URL: %@", fontName, url);

        NSURL    *fontURL       = [NSURL URLWithString:url];
        NSString *fontExtension = fontURL.pathExtension;

        NSURL *fontCachePath = [[[getRukcordDirectory() URLByAppendingPathComponent:@"downloads"
                                                                         isDirectory:YES]
            URLByAppendingPathComponent:@"fonts"
                            isDirectory:YES] URLByAppendingPathComponent:fontDefName
                                                             isDirectory:YES];

        fontCachePath = [fontCachePath
            URLByAppendingPathComponent:[NSString
                                            stringWithFormat:@"%@.%@", fontName, fontExtension]];

        NSURL *parentDir = [fontCachePath URLByDeletingLastPathComponent];
        if (![[NSFileManager defaultManager] fileExistsAtPath:parentDir.path])
        {
            BunnyLog(@"Creating parent directory: %@", parentDir.path);
            [[NSFileManager defaultManager] createDirectoryAtURL:parentDir
                                     withIntermediateDirectories:YES
                                                      attributes:nil
                                                           error:nil];
        }

        if (![[NSFileManager defaultManager] fileExistsAtPath:fontCachePath.path])
        {
            BunnyLog(@"Downloading font %@ from %@", fontName, url);
            NSData *data = [NSData dataWithContentsOfURL:fontURL];
            if (data)
            {
                BunnyLog(@"Writing font data to: %@", fontCachePath.path);
                [data writeToURL:fontCachePath atomically:YES];
            }
        }

        NSData *fontData = [NSData dataWithContentsOfURL:fontCachePath];
        if (fontData)
        {
            BunnyLog(@"Registering font %@ with provider", fontName);
            CGDataProviderRef provider =
                CGDataProviderCreateWithCFData((__bridge CFDataRef) fontData);
            CGFontRef font = CGFontCreateWithDataProvider(provider);

            if (font)
            {
                CFStringRef postScriptName = CGFontCopyPostScriptName(font);

                CTFontRef existingFont = CTFontCreateWithName(postScriptName, 0, NULL);
                if (existingFont)
                {
                    CFErrorRef unregisterError = NULL;
                    if (!CTFontManagerUnregisterGraphicsFont(font, &unregisterError))
                    {
                        BunnyLog(@"Failed to deregister font %@: %@",
                                 (__bridge NSString *) postScriptName,
                                 unregisterError
                                     ? (__bridge NSString *) CFErrorCopyDescription(unregisterError)
                                     : @"Unknown error");
                        if (unregisterError)
                            CFRelease(unregisterError);
                    }
                    CFRelease(existingFont);
                }

                CFErrorRef error = NULL;
                if (CTFontManagerRegisterGraphicsFont(font, &error))
                {
                    fontMap[fontName] = (__bridge NSString *) postScriptName;
                    BunnyLog(@"Successfully registered font %@ to %@", fontName,
                             (__bridge NSString *) postScriptName);

                    NSError *jsonError;
                    NSData  *jsonData = [NSJSONSerialization dataWithJSONObject:fontMap
                                                                       options:0
                                                                         error:&jsonError];
                    if (!jsonError)
                    {
                        [jsonData writeToURL:[getRukcordDirectory()
                                                 URLByAppendingPathComponent:@"fontMap.json"]
                                  atomically:YES];
                    }
                }
                else
                {
                    NSString *errorDesc = error
                                              ? (__bridge NSString *) CFErrorCopyDescription(error)
                                              : @"Unknown error";
                    BunnyLog(@"Failed to register font %@: %@", fontName, errorDesc);
                    if (error)
                        CFRelease(error);
                }

                CFRelease(postScriptName);
                CFRelease(font);
            }
            CGDataProviderRelease(provider);
        }
    }
    NSData *resolvedMap = [NSJSONSerialization dataWithJSONObject:fontMap options:0 error:nil];
    if (resolvedMap) [resolvedMap writeToURL:[getRukcordDirectory() URLByAppendingPathComponent:@"fontMap.json"] atomically:YES];
}

%ctor
{
    @autoreleasepool
    {
        fontMap = [NSMutableDictionary dictionary];

        NSData *fontData = [NSData
            dataWithContentsOfURL:[getRukcordDirectory() URLByAppendingPathComponent:@"fonts.json"]];
        if (fontData)
        {
            NSError      *jsonError;
            NSDictionary *fontDict = [NSJSONSerialization JSONObjectWithData:fontData
                                                                      options:0
                                                                        error:&jsonError];
            if (!jsonError && fontDict[@"main"])
            {
                BunnyLog(@"Applying fonts before hooks...");
                patchFonts(fontDict[@"main"], fontDict[@"name"]);
            }
        }

        BunnyLog(@"Font hooks initialized");
        %init;
        Class generator = NSClassFromString(@"DCDAttributedStringGenerator");
        if (RukcordFontMethodMatches(generator, @selector(font:withOptions:), YES, '@', 4)) { %init(RukcordNativeMessageFont); }
        Class attributedView = NSClassFromString(@"DCDAttributedTextView");
        if (RukcordFontMethodMatches(attributedView, @selector(setAttributedText:), NO, 'v', 3)) { %init(RukcordNativeAttributedText); }
    }
}
