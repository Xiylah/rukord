#line 1 "Sources/Themes.x"
#import "Themes.h"

static NSDictionary *gSemanticColors = nil;
static NSDictionary *gRawColors      = nil;
static NSMutableSet *loggedColors    = nil;


static NSInteger getThemeIndex(void) {
    Class DCDTheme = NSClassFromString(@"DCDTheme");
    if (!DCDTheme)
        return 0;

    SEL themeIndexSelector = NSSelectorFromString(@"themeIndex");
    if (![DCDTheme respondsToSelector:themeIndexSelector])
        return 0;

    typedef NSInteger (*ThemeIndexFunc)(id, SEL);
    return ((ThemeIndexFunc)objc_msgSend)(DCDTheme, themeIndexSelector);
}

static NSString *camelToSnakeCase(NSString *input) {
    NSMutableString *output   = [NSMutableString string];
    NSCharacterSet *uppercase = [NSCharacterSet uppercaseLetterCharacterSet];

    for (NSUInteger i = 0; i < input.length; i++) {
        unichar c = [input characterAtIndex:i];
        if (i > 0 && [uppercase characterIsMember:c]) {
            [output appendString:@"_"];
        }
        [output appendFormat:@"%c", toupper(c)];
    }
    return output;
}

static void swizzleRawColorMethods(void) {
    Class targetClass = [UIColor class];
    if (!targetClass)
        return;

    BunnyLog(@"Processing %lu raw color methods", (unsigned long)gRawColors.count);

    for (NSString *key in gRawColors) {
        SEL selector          = NSSelectorFromString(key);
        Method existingMethod = class_getClassMethod(targetClass, selector);

        IMP implementation = imp_implementationWithBlock(^UIColor *(id self) {
            NSString *hexColor = gRawColors[key];
            UIColor *color     = hexToUIColor(hexColor);
            if (color && ![loggedColors containsObject:key]) {
                [loggedColors addObject:key];
                BunnyLog(@"Applied raw color: %@ -> %@", key, hexColor);
            }
            return color ?: [UIColor clearColor];
        });

        if (existingMethod) {
            method_setImplementation(existingMethod, implementation);
        } else {
            class_addMethod(object_getClass(targetClass), selector, implementation, "@16@0:8");
        }
    }
}

static void swizzleDCDThemeColorMethods(void) {
    Class targetClass = objc_getClass("DCDThemeColor");
    if (!targetClass)
        return;

    unsigned int methodCount = 0;
    Method *methods          = class_copyMethodList(object_getClass(targetClass), &methodCount);
    if (!methods)
        return;

    BunnyLog(@"Processing %lu semantic color methods", (unsigned long)gSemanticColors.count);
    loggedColors = [NSMutableSet new];

    for (unsigned int i = 0; i < methodCount; i++) {
        Method method = methods[i];
        char returnType[256];
        method_getReturnType(method, returnType, sizeof(returnType));
        if (strcmp(returnType, @encode(UIColor *)) != 0)
            continue;

        SEL selector   = method_getName(method);
        NSString *name = NSStringFromSelector(selector);
        IMP original   = method_getImplementation(method);

        IMP replacement = imp_implementationWithBlock(^UIColor *(id self) {
            NSString *snakeKey = camelToSnakeCase(name);
            NSArray *colors    = gSemanticColors[snakeKey];

            if (colors && [colors isKindOfClass:[NSArray class]]) {
                NSInteger themeIndex = getThemeIndex() == 1 ? 1 : 0;
                if (themeIndex < colors.count) {
                    UIColor *color = hexToUIColor(colors[themeIndex]);
                    if (color) {
                        if (![loggedColors containsObject:name]) {
                            [loggedColors addObject:name];
                            BunnyLog(@"Applied theme color: %@ -> %@", name, colors[themeIndex]);
                        }
                        return color;
                    }
                }
            }
            return ((UIColor * (*)(id, SEL)) original)(self, selector);
        });

        method_setImplementation(method, replacement);
    }

    free(methods);
}


int getMode() {
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    NSNumber *mode = [defaults objectForKey:@"theme_mode"];
    return mode ? [mode intValue] : 0; 
}

NSDictionary* getCurrentTheme() {
   	NSFileManager *fileManager = [NSFileManager defaultManager];
   if (![fileManager fileExistsAtPath:CURRENT_THEME]) {
       BunnyLog(@"Theme file does not exist at: %@", CURRENT_THEME);
       return nil;
   }

   NSError *readError = nil;
   NSData *jsonData = [NSData dataWithContentsOfFile:CURRENT_THEME options:0 error:&readError];
   if (readError) {
       BunnyLog(@"Failed to read theme file: %@", readError);
       return nil;
   }

   NSError *jsonError = nil;
   NSDictionary *themeDict = [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:&jsonError];
   if (jsonError) {
       BunnyLog(@"Failed to parse theme JSON: %@", jsonError);
       return nil;
   }

   BunnyLog(@"Theme loaded: %@", themeDict);
   return [themeDict copy];
}




NSDictionary* getSemantic() {
    NSDictionary *theme = getCurrentTheme();
    if (!theme) {
        BunnyLog(@"No theme loaded");
        return nil;
    }

    NSDictionary *data = theme[@"data"];
    if (![data isKindOfClass:[NSDictionary class]]) {
        BunnyLog(@"Invalid theme data");
        return nil;
    }

    NSNumber *spec = data[@"spec"];
    NSDictionary *semanticSource = nil;

    if ([spec intValue] == 3 || !spec) {
        semanticSource = theme[@"main"][@"semantic"];
    } else if ([spec intValue] == 2) {
        semanticSource = data[@"semanticColors"];
    } else if ([spec intValue] == 1 || !spec) {
        semanticSource = data[@"theme_color_map"];
    } else {
        BunnyLog(@"Unsupported theme spec: %@", spec);
        return nil;
    }

    if (![semanticSource isKindOfClass:[NSDictionary class]]) {
        BunnyLog(@"No semantic colors found");
        return nil;
    }

    int mode = getMode(); 

    NSMutableDictionary *result = [NSMutableDictionary dictionary];

    for (NSString *key in semanticSource) {
        id value = semanticSource[key];
        if ([value isKindOfClass:[NSArray class]]) {
            NSArray *arr = (NSArray *)value;
            if (arr.count > mode) {
                NSString *colorStr = arr[mode];
                if ([colorStr isKindOfClass:[NSString class]]) {
                    result[key] = colorStr;
                }
            }
        }
    }

    return [result copy];
}

UIColor* colorFromHexString(NSString *hexString) {
	unsigned rgbValue = 0;
	NSScanner *scanner = [NSScanner scannerWithString:hexString];
	[scanner setScanLocation: 1];
	[scanner scanHexInt: &rgbValue];

	return [UIColor colorWithRed:((rgbValue & 0xFF0000) >> 16)/255.0 green:((rgbValue & 0xFF00) >> 8)/255.0 blue:(rgbValue & 0xFF)/255.0 alpha:1.0];
}

UIColor* getColor(NSString *name, NSString *kind) {
	if ([kind isEqual:@"semantic"]) {
	    NSDictionary *semanticColors = nil;
		if (!semanticColors) {
			semanticColors = getSemantic();
		}

		if (![semanticColors objectForKey:name]) {
			return NULL;
		}

		NSString *value = semanticColors[name];
		UIColor *color;

		color = colorFromHexString(value);
		return color;
	}
	return nil;
}


BOOL isThemeLight(UIColor *color) {
  CGFloat r, g, b;
  [color getRed:&r green:&g blue:&b alpha:NULL];
  CGFloat luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (luminance > 0.70) {
    return TRUE;
  }
  return FALSE;
}

@interface UIKeyboard : UIView
@end

@interface UIKeyboardDockView : UIView
@end

@interface TUIPredictionView : UIView
@end

@interface TUIEmojiSearchInputView : UIView
@end

@interface UIKBRenderConfig : NSObject
-(void)setLightKeyboard:(BOOL)light;
+(void)refreshKeyboard;
+(id)darkConfig;
+(id)defaultConfig;
+(id)defaultEmojiConfig;
+(id)lowQualityDarkConfig;
@end



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
@class UIKeyboard; @class TUIEmojiSearchInputView; @class UIKBRenderConfig; @class TUIPredictionView; @class UIKeyboardDockView; 

static __inline__ __attribute__((always_inline)) __attribute__((unused)) Class _logos_static_class_lookup$UIKBRenderConfig(void) { static Class _klass; if(!_klass) { _klass = objc_getClass("UIKBRenderConfig"); } return _klass; }
#line 263 "Sources/Themes.x"
static Class _logos_superclass$KEYBOARD$UIKeyboard; static void (*_logos_orig$KEYBOARD$UIKeyboard$didMoveToWindow)(_LOGOS_SELF_TYPE_NORMAL UIKeyboard* _LOGOS_SELF_CONST, SEL);static Class _logos_superclass$KEYBOARD$UIKeyboardDockView; static void (*_logos_orig$KEYBOARD$UIKeyboardDockView$didMoveToWindow)(_LOGOS_SELF_TYPE_NORMAL UIKeyboardDockView* _LOGOS_SELF_CONST, SEL);static Class _logos_superclass$KEYBOARD$UIKBRenderConfig; static Class _logos_supermetaclass$KEYBOARD$UIKBRenderConfig; static void (*_logos_orig$KEYBOARD$UIKBRenderConfig$setLightKeyboard$)(_LOGOS_SELF_TYPE_NORMAL UIKBRenderConfig* _LOGOS_SELF_CONST, SEL, BOOL);static Class _logos_superclass$KEYBOARD$TUIPredictionView; static void (*_logos_orig$KEYBOARD$TUIPredictionView$didMoveToWindow)(_LOGOS_SELF_TYPE_NORMAL TUIPredictionView* _LOGOS_SELF_CONST, SEL);static Class _logos_superclass$KEYBOARD$TUIEmojiSearchInputView; static void (*_logos_orig$KEYBOARD$TUIEmojiSearchInputView$didMoveToWindow)(_LOGOS_SELF_TYPE_NORMAL TUIEmojiSearchInputView* _LOGOS_SELF_CONST, SEL);

	id originalKeyboardColor;

	
	static void _logos_method$KEYBOARD$UIKeyboard$didMoveToWindow(_LOGOS_SELF_TYPE_NORMAL UIKeyboard* _LOGOS_SELF_CONST __unused self, SEL __unused _cmd) {
		_logos_orig$KEYBOARD$UIKeyboard$didMoveToWindow(self, _cmd);

		id color = getColor(@"KEYBOARD", @"semantic") ?: getColor(@"BACKGROUND_PRIMARY", @"semantic");

        [_logos_static_class_lookup$UIKBRenderConfig() refreshKeyboard];

		if (originalKeyboardColor != nil && originalKeyboardColor != color) {
			originalKeyboardColor = [self backgroundColor];
		}
		if (color != nil) {
				[self setBackgroundColor:color];
			} else {
			[self setBackgroundColor:originalKeyboardColor];
		}
	}

	

	

	static void _logos_method$KEYBOARD$UIKeyboardDockView$didMoveToWindow(_LOGOS_SELF_TYPE_NORMAL UIKeyboardDockView* _LOGOS_SELF_CONST __unused self, SEL __unused _cmd) {
		_logos_orig$KEYBOARD$UIKeyboardDockView$didMoveToWindow(self, _cmd);

		id color = getColor(@"KEYBOARD", @"semantic") ?: getColor(@"BACKGROUND_PRIMARY", @"semantic");
		if (originalKeyboardColor != nil && originalKeyboardColor != color) {
			originalKeyboardColor = [self backgroundColor];
		}
		if (color != nil) {
				[self setBackgroundColor:color];
			} else {
			[self setBackgroundColor:originalKeyboardColor];
		}
	}

	

	

	static void _logos_method$KEYBOARD$UIKBRenderConfig$setLightKeyboard$(_LOGOS_SELF_TYPE_NORMAL UIKBRenderConfig* _LOGOS_SELF_CONST __unused self, SEL __unused _cmd, BOOL arg1) {
	    _logos_orig$KEYBOARD$UIKBRenderConfig$setLightKeyboard$(self, _cmd, isThemeLight(getColor(@"KEYBOARD", @"semantic") ?: getColor(@"BACKGROUND_PRIMARY", @"semantic")));
    }

    
    static void _logos_meta_method$KEYBOARD$UIKBRenderConfig$refreshKeyboard(_LOGOS_SELF_TYPE_NORMAL Class _LOGOS_SELF_CONST __unused self, SEL __unused _cmd) {
       	[[self darkConfig] setLightKeyboard:TRUE];
    	[[self defaultConfig] setLightKeyboard:TRUE];
    	[[self defaultEmojiConfig] setLightKeyboard:TRUE];
    	[[self lowQualityDarkConfig] setLightKeyboard:TRUE];

    }

	

	
	static void _logos_method$KEYBOARD$TUIPredictionView$didMoveToWindow(_LOGOS_SELF_TYPE_NORMAL TUIPredictionView* _LOGOS_SELF_CONST __unused self, SEL __unused _cmd) {
		_logos_orig$KEYBOARD$TUIPredictionView$didMoveToWindow(self, _cmd);


		id color = getColor(@"KEYBOARD", @"semantic") ?: getColor(@"BACKGROUND_PRIMARY", @"semantic");
		if (originalKeyboardColor != nil && originalKeyboardColor != color) {
			originalKeyboardColor = [self backgroundColor];
		}
		if (color != nil) {
			[self setBackgroundColor:color];

			for (UIView *subview in self.subviews) {
				[subview setBackgroundColor:color];
			}
		} else {
			[self setBackgroundColor:originalKeyboardColor];

			for (UIView *subview in self.subviews) {
				[subview setBackgroundColor:originalKeyboardColor];
			}
		}
	}
	

	

	static void _logos_method$KEYBOARD$TUIEmojiSearchInputView$didMoveToWindow(_LOGOS_SELF_TYPE_NORMAL TUIEmojiSearchInputView* _LOGOS_SELF_CONST __unused self, SEL __unused _cmd) {
		_logos_orig$KEYBOARD$TUIEmojiSearchInputView$didMoveToWindow(self, _cmd);

		id color = getColor(@"KEYBOARD", @"semantic") ?: getColor(@"BACKGROUND_PRIMARY", @"semantic");
		if (originalKeyboardColor != nil && originalKeyboardColor != color) {
			originalKeyboardColor = [self backgroundColor];
		}
		if (color != nil) {
				[self setBackgroundColor:color];
			} else {
			[self setBackgroundColor:originalKeyboardColor];
		}
	}
	



void initializeThemeColors(NSDictionary *semanticColors, NSDictionary *rawColors) {
    if (!semanticColors || !rawColors)
        return;

    BunnyLog(@"Initializing theme (%lu semantic colors, %lu raw colors)",
             (unsigned long)semanticColors.count, (unsigned long)rawColors.count);

    gSemanticColors = [semanticColors copy];
    gRawColors      = [rawColors copy];
    loggedColors    = [NSMutableSet new];

    swizzleDCDThemeColorMethods();
    swizzleRawColorMethods();
}

static __attribute__((constructor)) void _logosLocalCtor_d10095fb(int __unused argc, char __unused **argv, char __unused **envp) {

    NSBundle* bundle = [NSBundle bundleWithPath:@"/System/Library/PrivateFrameworks/TextInputUI.framework"];
	if (!bundle.loaded) [bundle load];

	{Class _logos_class$KEYBOARD$UIKeyboard = objc_getClass("UIKeyboard"); _logos_superclass$KEYBOARD$UIKeyboard = class_getSuperclass(_logos_class$KEYBOARD$UIKeyboard); { _logos_register_hook(_logos_class$KEYBOARD$UIKeyboard, @selector(didMoveToWindow), (IMP)&_logos_method$KEYBOARD$UIKeyboard$didMoveToWindow, (IMP *)&_logos_orig$KEYBOARD$UIKeyboard$didMoveToWindow);}Class _logos_class$KEYBOARD$UIKeyboardDockView = objc_getClass("UIKeyboardDockView"); _logos_superclass$KEYBOARD$UIKeyboardDockView = class_getSuperclass(_logos_class$KEYBOARD$UIKeyboardDockView); { _logos_register_hook(_logos_class$KEYBOARD$UIKeyboardDockView, @selector(didMoveToWindow), (IMP)&_logos_method$KEYBOARD$UIKeyboardDockView$didMoveToWindow, (IMP *)&_logos_orig$KEYBOARD$UIKeyboardDockView$didMoveToWindow);}Class _logos_class$KEYBOARD$UIKBRenderConfig = objc_getClass("UIKBRenderConfig"); Class _logos_metaclass$KEYBOARD$UIKBRenderConfig = object_getClass(_logos_class$KEYBOARD$UIKBRenderConfig); _logos_superclass$KEYBOARD$UIKBRenderConfig = class_getSuperclass(_logos_class$KEYBOARD$UIKBRenderConfig); _logos_supermetaclass$KEYBOARD$UIKBRenderConfig = class_getSuperclass(_logos_metaclass$KEYBOARD$UIKBRenderConfig); { _logos_register_hook(_logos_class$KEYBOARD$UIKBRenderConfig, @selector(setLightKeyboard:), (IMP)&_logos_method$KEYBOARD$UIKBRenderConfig$setLightKeyboard$, (IMP *)&_logos_orig$KEYBOARD$UIKBRenderConfig$setLightKeyboard$);}{ char _typeEncoding[1024]; unsigned int i = 0; _typeEncoding[i] = 'v'; i += 1; _typeEncoding[i] = '@'; i += 1; _typeEncoding[i] = ':'; i += 1; _typeEncoding[i] = '\0'; class_addMethod(_logos_metaclass$KEYBOARD$UIKBRenderConfig, @selector(refreshKeyboard), (IMP)&_logos_meta_method$KEYBOARD$UIKBRenderConfig$refreshKeyboard, _typeEncoding); }Class _logos_class$KEYBOARD$TUIPredictionView = objc_getClass("TUIPredictionView"); _logos_superclass$KEYBOARD$TUIPredictionView = class_getSuperclass(_logos_class$KEYBOARD$TUIPredictionView); { _logos_register_hook(_logos_class$KEYBOARD$TUIPredictionView, @selector(didMoveToWindow), (IMP)&_logos_method$KEYBOARD$TUIPredictionView$didMoveToWindow, (IMP *)&_logos_orig$KEYBOARD$TUIPredictionView$didMoveToWindow);}Class _logos_class$KEYBOARD$TUIEmojiSearchInputView = objc_getClass("TUIEmojiSearchInputView"); _logos_superclass$KEYBOARD$TUIEmojiSearchInputView = class_getSuperclass(_logos_class$KEYBOARD$TUIEmojiSearchInputView); { _logos_register_hook(_logos_class$KEYBOARD$TUIEmojiSearchInputView, @selector(didMoveToWindow), (IMP)&_logos_method$KEYBOARD$TUIEmojiSearchInputView$didMoveToWindow, (IMP *)&_logos_orig$KEYBOARD$TUIEmojiSearchInputView$didMoveToWindow);}}

}
