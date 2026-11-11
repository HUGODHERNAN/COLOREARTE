import {
    calculateSimilarity,
    generateBotGuessHex,
    generateRandomTargetHex,
    hexToRgb,
    hslToRgb,
    normalizeHex,
    rgbToHex,
    rgbToHsl,
    rgbToLab
} from '../src/domain/color.js';
import { assert, suite } from './testRunner.js';

suite('domain/color', (test) => {
    test('normalizeHex normalizes 3-char, 6-char, and noisy inputs', () => {
        assert.equal(normalizeHex('#f0a'), '#FF00AA');
        assert.equal(normalizeHex('ff5733'), '#FF5733');
        assert.equal(normalizeHex('  #2ec4b6  '), '#2EC4B6');
        assert.equal(normalizeHex(''), null);
        assert.equal(normalizeHex(null), null);
        assert.equal(normalizeHex('#12345'), null);
    });

    test('hexToRgb and rgbToHex round-trip and clamp out-of-range channels', () => {
        assert.deepEqual(hexToRgb('#FF5733'), { r: 255, g: 87, b: 51 });
        assert.deepEqual(hexToRgb('invalid'), { r: 128, g: 128, b: 128 });
        assert.equal(rgbToHex(255, 87, 51), '#FF5733');
        assert.equal(rgbToHex(-10, 300, 15.6), '#00FF10');
    });

    test('hslToRgb and rgbToHsl handle primary colors and neutral gray', () => {
        assert.deepEqual(hslToRgb(0, 100, 50), { r: 255, g: 0, b: 0 });
        assert.deepEqual(hslToRgb(120, 100, 50), { r: 0, g: 255, b: 0 });
        assert.deepEqual(hslToRgb(240, 100, 50), { r: 0, g: 0, b: 255 });
        assert.deepEqual(rgbToHsl(128, 128, 128), { h: 0, s: 0, l: 50 });
    });

    test('rgbToLab maps black and white accurately', () => {
        const white = rgbToLab({ r: 255, g: 255, b: 255 });
        const black = rgbToLab({ r: 0, g: 0, b: 0 });
        assert.closeTo(white.L, 100, 0.2);
        assert.closeTo(white.a, 0, 0.2);
        assert.closeTo(white.b, 0, 0.2);
        assert.closeTo(black.L, 0, 0.2);
    });

    test('calculateSimilarity returns 100 for identical colors and ranks closer colors higher', () => {
        assert.equal(calculateSimilarity('#ff5733', '#FF5733'), 100);
        const close = calculateSimilarity('#FF5733', '#FE5A36');
        const far = calculateSimilarity('#FF5733', '#00AAFF');
        assert.ok(close > 95, `Expected close similarity > 95, got ${close}`);
        assert.ok(close > far, `Expected ${close} > ${far}`);
        assert.ok(calculateSimilarity('#000000', '#FFFFFF') < 10);
    });

    test('generateRandomTargetHex and generateBotGuessHex return valid #RRGGBB with deterministic rng', () => {
        const target = generateRandomTargetHex(() => 0.5);
        assert.ok(/^#[0-9A-F]{6}$/.test(target), `Unexpected target hex: ${target}`);
        const botGuess = generateBotGuessHex('#808080', () => 0.5);
        assert.equal(botGuess, '#808080');
    });
});

