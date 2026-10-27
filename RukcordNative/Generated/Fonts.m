#line 1 "Sources/Fonts.x"
#import <CoreFoundation/CoreFoundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <CoreText/CoreText.h>
#import <objc/runtime.h>

#import "Fonts.h"
#import "FontPolicy.h"
#import "Logger.h"
#import "Utils.h"

NSMutableDictionary<NSString *, NSString *> *fontMap;



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
@class UITextField; @class DCDAttributedTextView; @class UITextView; @class UIFont; @class DCDAttributedStringGenerator; 
static Class _logos_supermetaclass$_ungrouped$UIFont; static UIFont * (*_logos_meta_orig$_ungrouped$UIFont$fontWithName$size$)(_LOGOS_SELF_TYPE_NORMAL Class _LOGOS_SELF_CONST, SEL, NSString *, CGFloat);static UIFont * (*_logos_meta_orig$_ungrouped$UIFont$fontWithDescriptor$size$)(_LOGOS_SELF_TYPE_NORMAL Class _LOGOS_SELF_CONST, SEL, UIFontDescriptor *, CGFloat);static UIFont * (*_logos_meta_orig$_ungrouped$UIFont$systemFontOfSize$)(_LOGOS_SELF_TYPE_NORMAL Class _LOGOS_SELF_CONST, SEL, CGFloat);static UIFont * (*_logos_meta_orig$_ungrouped$UIFont$systemFontOfSize$weight$)(_LOGOS_SELF_TYPE_NORMAL Class _LOGOS_SELF_CONST, SEL, CGFloat, CGFloat);static UIFont * (*_logos_meta_orig$_ungrouped$UIFont$boldSystemFontOfSize$)(_LOGOS_SELF_TYPE_NORMAL Class _LOGOS_SELF_CONST, SEL, CGFloat);static UIFont * (*_logos_meta_orig$_ungrouped$UIFont$italicSystemFontOfSize$)(_LOGOS_SELF_TYPE_NORMAL Class _LOGOS_SELF_CONST, SEL, CGFloat);static UIFont * (*_logos_meta_orig$_ungrouped$UIFont$preferredFontForTextStyle$)(_LOGOS_SELF_TYPE_NORMAL Class _LOGOS_SELF_CONST, SEL, UIFontTextStyle);static UIFont * (*_logos_meta_orig$_ungrouped$UIFont$preferredFontForTextStyle$compatibleWithTraitCollection$)(_LOGOS_SELF_TYPE_NORMAL Class _LOGOS_SELF_CONST, SEL, UIFontTextStyle, UITraitCollection *);static Class _logos_superclass$_ungrouped$UITextView; static void (*_logos_orig$_ungrouped$UITextView$setFont$)(_LOGOS_SELF_TYPE_NORMAL UITextView* _LOGOS_SELF_CONST, SEL, UIFont *);static void (*_logos_orig$_ungrouped$UITextView$setAttributedText$)(_LOGOS_SELF_TYPE_NORMAL UITextView* _LOGOS_SELF_CONST, SEL, NSAttributedString *);static void (*_logos_orig$_ungrouped$UITextView$setTypingAttributes$)(_LOGOS_SELF_TYPE_NORMAL UITextView* _LOGOS_SELF_CONST, SEL, NSDictionary *);static Class _logos_superclass$_ungrouped$UITextField; static void (*_logos_orig$_ungrouped$UITextField$setFont$)(_LOGOS_SELF_TYPE_NORMAL UITextField* _LOGOS_SELF_CONST, SEL, UIFont *);static void (*_logos_orig$_ungrouped$UITextField$setAttributedText$)(_LOGOS_SELF_TYPE_NORMAL UITextField* _LOGOS_SELF_CONST, SEL, NSAttributedString *);static void (*_logos_orig$_ungrouped$UITextField$setDefaultTextAttributes$)(_LOGOS_SELF_TYPE_NORMAL UITextField* _LOGOS_SELF_CONST, SEL, NSDictionary *);

#line 90 "Sources/Fonts.x"

static UIFont * _logos_meta_method$_ungrouped$UIFont$fontWithName$size$(_LOGOS_SELF_TYPE_NORMAL Class _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, NSString * name, CGFloat size) {
    NSString *replacementName = RukcordReplacementForFont(name, nil);
    if (replacementName) {
        UIFontDescriptor *fallback = [UIFontDescriptor fontDescriptorWithName:name size:size];
        UIFontDescriptor *descriptor = [[UIFontDescriptor fontDescriptorWithName:replacementName size:size] fontDescriptorByAddingAttributes:@{UIFontDescriptorCascadeListAttribute: @[fallback]}];
        return [UIFont fontWithDescriptor:descriptor size:size];
    }
    return _logos_meta_orig$_ungrouped$UIFont$fontWithName$size$(self, _cmd, name, size);
}
static UIFont * _logos_meta_method$_ungrouped$UIFont$fontWithDescriptor$size$(_LOGOS_SELF_TYPE_NORMAL Class _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, UIFontDescriptor * descriptor, CGFloat size) {
    NSString *replacementName = RukcordReplacementForFont(descriptor.postscriptName, descriptor);
    if (replacementName) {
        UIFontDescriptor *replacement = [[UIFontDescriptor fontDescriptorWithName:replacementName size:size] fontDescriptorByAddingAttributes:@{UIFontDescriptorCascadeListAttribute: @[descriptor]}];
        
        return _logos_meta_orig$_ungrouped$UIFont$fontWithDescriptor$size$(self, _cmd, replacement, size);
    }
    return _logos_meta_orig$_ungrouped$UIFont$fontWithDescriptor$size$(self, _cmd, descriptor, size);
}
static UIFont * _logos_meta_method$_ungrouped$UIFont$systemFontOfSize$(_LOGOS_SELF_TYPE_NORMAL Class _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, CGFloat size) {
    UIFont *original = _logos_meta_orig$_ungrouped$UIFont$systemFontOfSize$(self, _cmd, size);
    return RukcordSystemFont(original, UIFontWeightRegular, NO, NO);
}
static UIFont * _logos_meta_method$_ungrouped$UIFont$systemFontOfSize$weight$(_LOGOS_SELF_TYPE_NORMAL Class _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, CGFloat size, CGFloat weight) {
    UIFont *original = _logos_meta_orig$_ungrouped$UIFont$systemFontOfSize$weight$(self, _cmd, size, weight);
    return RukcordSystemFont(original, weight, NO, NO);
}
static UIFont * _logos_meta_method$_ungrouped$UIFont$boldSystemFontOfSize$(_LOGOS_SELF_TYPE_NORMAL Class _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, CGFloat size) {
    UIFont *original = _logos_meta_orig$_ungrouped$UIFont$boldSystemFontOfSize$(self, _cmd, size);
    return RukcordSystemFont(original, UIFontWeightBold, NO, NO);
}
static UIFont * _logos_meta_method$_ungrouped$UIFont$italicSystemFontOfSize$(_LOGOS_SELF_TYPE_NORMAL Class _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, CGFloat size) {
    UIFont *original = _logos_meta_orig$_ungrouped$UIFont$italicSystemFontOfSize$(self, _cmd, size);
    return RukcordSystemFont(original, UIFontWeightRegular, YES, NO);
}
static UIFont * _logos_meta_method$_ungrouped$UIFont$preferredFontForTextStyle$(_LOGOS_SELF_TYPE_NORMAL Class _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, UIFontTextStyle style) {
    
    UIFont *original = _logos_meta_orig$_ungrouped$UIFont$preferredFontForTextStyle$(self, _cmd, style);
    return RukcordSystemFont(original, UIFontWeightRegular, NO, YES);
}
static UIFont * _logos_meta_method$_ungrouped$UIFont$preferredFontForTextStyle$compatibleWithTraitCollection$(_LOGOS_SELF_TYPE_NORMAL Class _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, UIFontTextStyle style, UITraitCollection * collection) {
    UIFont *original = _logos_meta_orig$_ungrouped$UIFont$preferredFontForTextStyle$compatibleWithTraitCollection$(self, _cmd, style, collection);
    return RukcordSystemFont(original, UIFontWeightRegular, NO, YES);
}




static Class _logos_supermetaclass$RukcordNativeMessageFont$DCDAttributedStringGenerator; static id (*_logos_meta_orig$RukcordNativeMessageFont$DCDAttributedStringGenerator$font$withOptions$)(_LOGOS_SELF_TYPE_NORMAL Class _LOGOS_SELF_CONST, SEL, id, id);

static id _logos_meta_method$RukcordNativeMessageFont$DCDAttributedStringGenerator$font$withOptions$(_LOGOS_SELF_TYPE_NORMAL Class _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, id font, id options) {
    id result = _logos_meta_orig$RukcordNativeMessageFont$DCDAttributedStringGenerator$font$withOptions$(self, _cmd, font, options);
    return RukcordMessageFont(result);
}


static Class _logos_superclass$RukcordNativeAttributedText$DCDAttributedTextView; static void (*_logos_orig$RukcordNativeAttributedText$DCDAttributedTextView$setAttributedText$)(_LOGOS_SELF_TYPE_NORMAL DCDAttributedTextView* _LOGOS_SELF_CONST, SEL, NSAttributedString *);

static void _logos_method$RukcordNativeAttributedText$DCDAttributedTextView$setAttributedText$(_LOGOS_SELF_TYPE_NORMAL DCDAttributedTextView* _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, NSAttributedString * text) {
    NSAttributedString *replacement = RukcordMessageText(text);
    _logos_orig$RukcordNativeAttributedText$DCDAttributedTextView$setAttributedText$(self, _cmd, replacement);
}




static void _logos_method$_ungrouped$UITextView$setFont$(_LOGOS_SELF_TYPE_NORMAL UITextView* _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, UIFont * font) {
    UIFont *replacement = RukcordMessageFont(font);
    _logos_orig$_ungrouped$UITextView$setFont$(self, _cmd, replacement);
}
static void _logos_method$_ungrouped$UITextView$setAttributedText$(_LOGOS_SELF_TYPE_NORMAL UITextView* _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, NSAttributedString * text) {
    NSAttributedString *replacement = RukcordMessageText(text);
    _logos_orig$_ungrouped$UITextView$setAttributedText$(self, _cmd, replacement);
}
static void _logos_method$_ungrouped$UITextView$setTypingAttributes$(_LOGOS_SELF_TYPE_NORMAL UITextView* _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, NSDictionary * attributes) {
    NSDictionary *replacement = RukcordTypingAttributes(attributes);
    _logos_orig$_ungrouped$UITextView$setTypingAttributes$(self, _cmd, replacement);
}


static void _logos_method$_ungrouped$UITextField$setFont$(_LOGOS_SELF_TYPE_NORMAL UITextField* _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, UIFont * font) {
    UIFont *replacement = RukcordMessageFont(font);
    _logos_orig$_ungrouped$UITextField$setFont$(self, _cmd, replacement);
}
static void _logos_method$_ungrouped$UITextField$setAttributedText$(_LOGOS_SELF_TYPE_NORMAL UITextField* _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, NSAttributedString * text) {
    NSAttributedString *replacement = RukcordMessageText(text);
    _logos_orig$_ungrouped$UITextField$setAttributedText$(self, _cmd, replacement);
}
static void _logos_method$_ungrouped$UITextField$setDefaultTextAttributes$(_LOGOS_SELF_TYPE_NORMAL UITextField* _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, NSDictionary * attributes) {
    NSDictionary *replacement = RukcordTypingAttributes(attributes);
    _logos_orig$_ungrouped$UITextField$setDefaultTextAttributes$(self, _cmd, replacement);
}


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

static __attribute__((constructor)) void _logosLocalCtor_824ffaf2(int __unused argc, char __unused **argv, char __unused **envp)
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
        {Class _logos_class$_ungrouped$UIFont = objc_getClass("UIFont"); Class _logos_metaclass$_ungrouped$UIFont = object_getClass(_logos_class$_ungrouped$UIFont); _logos_supermetaclass$_ungrouped$UIFont = class_getSuperclass(_logos_metaclass$_ungrouped$UIFont); { _logos_register_hook(_logos_metaclass$_ungrouped$UIFont, @selector(fontWithName:size:), (IMP)&_logos_meta_method$_ungrouped$UIFont$fontWithName$size$, (IMP *)&_logos_meta_orig$_ungrouped$UIFont$fontWithName$size$);}{ _logos_register_hook(_logos_metaclass$_ungrouped$UIFont, @selector(fontWithDescriptor:size:), (IMP)&_logos_meta_method$_ungrouped$UIFont$fontWithDescriptor$size$, (IMP *)&_logos_meta_orig$_ungrouped$UIFont$fontWithDescriptor$size$);}{ _logos_register_hook(_logos_metaclass$_ungrouped$UIFont, @selector(systemFontOfSize:), (IMP)&_logos_meta_method$_ungrouped$UIFont$systemFontOfSize$, (IMP *)&_logos_meta_orig$_ungrouped$UIFont$systemFontOfSize$);}{ _logos_register_hook(_logos_metaclass$_ungrouped$UIFont, @selector(systemFontOfSize:weight:), (IMP)&_logos_meta_method$_ungrouped$UIFont$systemFontOfSize$weight$, (IMP *)&_logos_meta_orig$_ungrouped$UIFont$systemFontOfSize$weight$);}{ _logos_register_hook(_logos_metaclass$_ungrouped$UIFont, @selector(boldSystemFontOfSize:), (IMP)&_logos_meta_method$_ungrouped$UIFont$boldSystemFontOfSize$, (IMP *)&_logos_meta_orig$_ungrouped$UIFont$boldSystemFontOfSize$);}{ _logos_register_hook(_logos_metaclass$_ungrouped$UIFont, @selector(italicSystemFontOfSize:), (IMP)&_logos_meta_method$_ungrouped$UIFont$italicSystemFontOfSize$, (IMP *)&_logos_meta_orig$_ungrouped$UIFont$italicSystemFontOfSize$);}{ _logos_register_hook(_logos_metaclass$_ungrouped$UIFont, @selector(preferredFontForTextStyle:), (IMP)&_logos_meta_method$_ungrouped$UIFont$preferredFontForTextStyle$, (IMP *)&_logos_meta_orig$_ungrouped$UIFont$preferredFontForTextStyle$);}{ _logos_register_hook(_logos_metaclass$_ungrouped$UIFont, @selector(preferredFontForTextStyle:compatibleWithTraitCollection:), (IMP)&_logos_meta_method$_ungrouped$UIFont$preferredFontForTextStyle$compatibleWithTraitCollection$, (IMP *)&_logos_meta_orig$_ungrouped$UIFont$preferredFontForTextStyle$compatibleWithTraitCollection$);}Class _logos_class$_ungrouped$UITextView = objc_getClass("UITextView"); _logos_superclass$_ungrouped$UITextView = class_getSuperclass(_logos_class$_ungrouped$UITextView); { _logos_register_hook(_logos_class$_ungrouped$UITextView, @selector(setFont:), (IMP)&_logos_method$_ungrouped$UITextView$setFont$, (IMP *)&_logos_orig$_ungrouped$UITextView$setFont$);}{ _logos_register_hook(_logos_class$_ungrouped$UITextView, @selector(setAttributedText:), (IMP)&_logos_method$_ungrouped$UITextView$setAttributedText$, (IMP *)&_logos_orig$_ungrouped$UITextView$setAttributedText$);}{ _logos_register_hook(_logos_class$_ungrouped$UITextView, @selector(setTypingAttributes:), (IMP)&_logos_method$_ungrouped$UITextView$setTypingAttributes$, (IMP *)&_logos_orig$_ungrouped$UITextView$setTypingAttributes$);}Class _logos_class$_ungrouped$UITextField = objc_getClass("UITextField"); _logos_superclass$_ungrouped$UITextField = class_getSuperclass(_logos_class$_ungrouped$UITextField); { _logos_register_hook(_logos_class$_ungrouped$UITextField, @selector(setFont:), (IMP)&_logos_method$_ungrouped$UITextField$setFont$, (IMP *)&_logos_orig$_ungrouped$UITextField$setFont$);}{ _logos_register_hook(_logos_class$_ungrouped$UITextField, @selector(setAttributedText:), (IMP)&_logos_method$_ungrouped$UITextField$setAttributedText$, (IMP *)&_logos_orig$_ungrouped$UITextField$setAttributedText$);}{ _logos_register_hook(_logos_class$_ungrouped$UITextField, @selector(setDefaultTextAttributes:), (IMP)&_logos_method$_ungrouped$UITextField$setDefaultTextAttributes$, (IMP *)&_logos_orig$_ungrouped$UITextField$setDefaultTextAttributes$);}}
        Class generator = NSClassFromString(@"DCDAttributedStringGenerator");
        if (RukcordFontMethodMatches(generator, @selector(font:withOptions:), YES, '@', 4)) { {Class _logos_class$RukcordNativeMessageFont$DCDAttributedStringGenerator = objc_getClass("DCDAttributedStringGenerator"); Class _logos_metaclass$RukcordNativeMessageFont$DCDAttributedStringGenerator = object_getClass(_logos_class$RukcordNativeMessageFont$DCDAttributedStringGenerator); _logos_supermetaclass$RukcordNativeMessageFont$DCDAttributedStringGenerator = class_getSuperclass(_logos_metaclass$RukcordNativeMessageFont$DCDAttributedStringGenerator); { _logos_register_hook(_logos_metaclass$RukcordNativeMessageFont$DCDAttributedStringGenerator, @selector(font:withOptions:), (IMP)&_logos_meta_method$RukcordNativeMessageFont$DCDAttributedStringGenerator$font$withOptions$, (IMP *)&_logos_meta_orig$RukcordNativeMessageFont$DCDAttributedStringGenerator$font$withOptions$);}} }
        Class attributedView = NSClassFromString(@"DCDAttributedTextView");
        if (RukcordFontMethodMatches(attributedView, @selector(setAttributedText:), NO, 'v', 3)) { {Class _logos_class$RukcordNativeAttributedText$DCDAttributedTextView = objc_getClass("DCDAttributedTextView"); _logos_superclass$RukcordNativeAttributedText$DCDAttributedTextView = class_getSuperclass(_logos_class$RukcordNativeAttributedText$DCDAttributedTextView); { _logos_register_hook(_logos_class$RukcordNativeAttributedText$DCDAttributedTextView, @selector(setAttributedText:), (IMP)&_logos_method$RukcordNativeAttributedText$DCDAttributedTextView$setAttributedText$, (IMP *)&_logos_orig$RukcordNativeAttributedText$DCDAttributedTextView$setAttributedText$);}} }
    }
}
