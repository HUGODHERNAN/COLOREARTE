import { DEFAULT_GUESS_HEX } from '../config/constants.js';

/**
 * Normalizes a hex color string to uppercase #RRGGBB format, or returns null if invalid.
 */
export function normalizeHex(input) {
    if (!input) return null;
    let clean = String(input).trim().replace(/^#/, '').replace(/[^0-9A-Fa-f]/g, '');
    if (clean.length === 3) {
        clean = clean.split('').map(c => c + c).join('');
    }
    if (clean.length === 6) {
        return '#' + clean.toUpperCase();
    }
    return null;
}

/**
 * Converts a hex string into an { r, g, b } object (0-255). Falls back to neutral gray.
 */
export function hexToRgb(hex) {
    const valid = normalizeHex(hex) || DEFAULT_GUESS_HEX;
    const num = parseInt(valid.slice(1), 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

/**
 * Converts RGB channel values (0-255) to an uppercase #RRGGBB hex string.
 */
export function rgbToHex(r, g, b) {
    const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
    return '#' + [clamp(r), clamp(g), clamp(b)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
}

/**
 * Converts HSL (h: 0-360, s: 0-100, l: 0-100) to { r, g, b } (0-255).
 */
export function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return {
        r: Math.round(255 * f(0)),
        g: Math.round(255 * f(8)),
        b: Math.round(255 * f(4))
    };
}

/**
 * Converts RGB (0-255) to { h, s, l } (h: 0-360, s: 0-100, l: 0-100).
 */
export function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}

/**
 * Converts sRGB ({ r, g, b }) into CIE L*a*b* coordinates (D65 illuminant).
 */
export function rgbToLab(rgb) {
    let r = rgb.r / 255;
    let g = rgb.g / 255;
    let b = rgb.b / 255;

    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
    let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

    x = x > 0.008856 ? Math.cbrt(x) : (7.787 * x) + 16 / 116;
    y = y > 0.008856 ? Math.cbrt(y) : (7.787 * y) + 16 / 116;
    z = z > 0.008856 ? Math.cbrt(z) : (7.787 * z) + 16 / 116;

    return {
        L: (116 * y) - 16,
        a: 500 * (x - y),
        b: 200 * (y - z)
    };
}

/**
 * Computes perceptual color similarity percentage (0-100) blending RGB Euclidean
 * distance (55%) and CIELAB Delta-E (45%).
 */
export function calculateSimilarity(targetHex, guessHex) {
    const hex1 = normalizeHex(targetHex) || '#000000';
    const hex2 = normalizeHex(guessHex) || DEFAULT_GUESS_HEX;
    if (hex1 === hex2) return 100;

    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);
    const dR = rgb1.r - rgb2.r;
    const dG = rgb1.g - rgb2.g;
    const dB = rgb1.b - rgb2.b;
    const euclidean = Math.sqrt(dR * dR + dG * dG + dB * dB);
    const maxEuclidean = Math.sqrt(255 * 255 * 3);
    const rgbSim = Math.max(0, 100 * (1 - euclidean / maxEuclidean));

    const lab1 = rgbToLab(rgb1);
    const lab2 = rgbToLab(rgb2);
    const deltaE = Math.sqrt(
        Math.pow(lab1.L - lab2.L, 2) +
        Math.pow(lab1.a - lab2.a, 2) +
        Math.pow(lab1.b - lab2.b, 2)
    );
    const labSim = Math.max(0, 100 * (1 - deltaE / 115));

    return Number(((rgbSim * 0.55) + (labSim * 0.45)).toFixed(2));
}

/**
 * Generates a vivid random target HEX color suitable for memory rounds.
 */
export function generateRandomTargetHex(rng = Math.random) {
    const h = Math.floor(rng() * 360);
    const s = 45 + Math.floor(rng() * 50);
    const l = 28 + Math.floor(rng() * 48);
    const rgb = hslToRgb(h, s, l);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Generates a bot guess near the target color with controlled RGB channel jitter.
 */
export function generateBotGuessHex(targetHex, rng = Math.random) {
    const targetRgb = hexToRgb(targetHex);
    const jitter = () => Math.floor((rng() - 0.5) * 65);
    return rgbToHex(targetRgb.r + jitter(), targetRgb.g + jitter(), targetRgb.b + jitter());
}

