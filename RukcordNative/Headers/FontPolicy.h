#pragma once

typedef enum {
    RukcordFontRegular, RukcordFontMedium, RukcordFontBold,
    RukcordFontItalic, RukcordFontBoldItalic
} RukcordFontRole;

// UIKit weights are normalized. Tolerate CSS-style weights supplied by a
// host descriptor without interpreting normal (400) as bold.
static inline double RukcordNormalizeWeight(double weight) {
    if (weight != weight) return 0;
    if (weight >= -1 && weight <= 1) return weight;
    if (weight >= 600 && weight <= 1000) return .4;
    if (weight >= 500 && weight < 600) return .23;
    return 0;
}
static inline RukcordFontRole RukcordChooseFontRole(double weight, int bold, int italic) {
    double normalized = RukcordNormalizeWeight(weight);
    int useBold = bold || normalized >= .3;
    if (italic) return useBold ? RukcordFontBoldItalic : RukcordFontItalic;
    return useBold ? RukcordFontBold : normalized >= .23 ? RukcordFontMedium : RukcordFontRegular;
}
