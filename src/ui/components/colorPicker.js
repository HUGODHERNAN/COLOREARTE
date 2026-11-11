import { DEFAULT_GUESS_HEX } from '../../config/constants.js';
import {
    hexToRgb,
    hslToRgb,
    normalizeHex,
    rgbToHex,
    rgbToHsl
} from '../../domain/color.js';

/**
 * Synchronizes HSL sliders, RGB sliders, HEX text input, native color picker, and swatch preview.
 */
export function createColorPicker() {
    let locked = false;
    let currentHex = DEFAULT_GUESS_HEX;

    const swatch = document.getElementById('player-current-swatch');
    const hexBadge = document.getElementById('player-current-hex-badge');
    const hexInput = document.getElementById('guess-hex-input');
    const nativePicker = document.getElementById('guess-native-picker');

    const sliderH = document.getElementById('slider-h');
    const sliderS = document.getElementById('slider-s');
    const sliderL = document.getElementById('slider-l');
    const lblHue = document.getElementById('lbl-hue');
    const lblSat = document.getElementById('lbl-sat');
    const lblLight = document.getElementById('lbl-light');

    const sliderR = document.getElementById('slider-r');
    const sliderG = document.getElementById('slider-g');
    const sliderB = document.getElementById('slider-b');
    const lblR = document.getElementById('lbl-r');
    const lblG = document.getElementById('lbl-g');
    const lblB = document.getElementById('lbl-b');

    const allControls = [sliderH, sliderS, sliderL, sliderR, sliderG, sliderB, hexInput, nativePicker];

    function setColor(hex, skipHslSync = false) {
        const validHex = normalizeHex(hex) || '#4095BF';
        currentHex = validHex;

        swatch.style.backgroundColor = validHex;
        hexBadge.textContent = validHex;
        nativePicker.value = validHex;

        if (document.activeElement !== hexInput) {
            hexInput.value = validHex.replace('#', '');
        }

        const rgb = hexToRgb(validHex);
        sliderR.value = rgb.r;
        sliderG.value = rgb.g;
        sliderB.value = rgb.b;
        lblR.textContent = rgb.r;
        lblG.textContent = rgb.g;
        lblB.textContent = rgb.b;

        if (!skipHslSync) {
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
            const prevH = parseInt(sliderH.value, 10) || 0;
            const prevS = parseInt(sliderS.value, 10) || 50;

            // Preserve Hue/Saturation at black (L=0) or white (L=100) so sliders do not snap back to 0
            const safeH = (hsl.l === 0 || hsl.l === 100 || hsl.s === 0) ? prevH : hsl.h;
            const safeS = (hsl.l === 0 || hsl.l === 100) ? prevS : hsl.s;

            sliderH.value = safeH;
            sliderS.value = safeS;
            sliderL.value = hsl.l;
            lblHue.textContent = `${safeH}°`;
            lblSat.textContent = `${safeS}%`;
            lblLight.textContent = `${hsl.l}%`;
        }
    }

    function onHslInput() {
        if (locked) return;
        const h = parseInt(sliderH.value, 10);
        const s = parseInt(sliderS.value, 10);
        const l = parseInt(sliderL.value, 10);

        lblHue.textContent = `${h}°`;
        lblSat.textContent = `${s}%`;
        lblLight.textContent = `${l}%`;

        const rgb = hslToRgb(h, s, l);
        setColor(rgbToHex(rgb.r, rgb.g, rgb.b), true);
    }

    function onRgbInput() {
        if (locked) return;
        const r = parseInt(sliderR.value, 10);
        const g = parseInt(sliderG.value, 10);
        const b = parseInt(sliderB.value, 10);
        setColor(rgbToHex(r, g, b), false);
    }

    function onDirectHexInput(val) {
        if (locked) return;
        const valid = normalizeHex(val);
        if (valid) setColor(valid, false);
    }

    [sliderH, sliderS, sliderL].forEach(el => el?.addEventListener('input', onHslInput));
    [sliderR, sliderG, sliderB].forEach(el => el?.addEventListener('input', onRgbInput));
    hexInput?.addEventListener('input', (e) => onDirectHexInput(e.target.value));
    nativePicker?.addEventListener('input', (e) => onDirectHexInput(e.target.value));

    function reset() {
        locked = false;
        allControls.forEach(el => {
            if (el) el.disabled = false;
        });

        const initialH = 200;
        const initialS = 50;
        const initialL = 50;
        sliderH.value = initialH;
        sliderS.value = initialS;
        sliderL.value = initialL;
        lblHue.textContent = `${initialH}°`;
        lblSat.textContent = `${initialS}%`;
        lblLight.textContent = `${initialL}%`;

        const startRgb = hslToRgb(initialH, initialS, initialL);
        setColor(rgbToHex(startRgb.r, startRgb.g, startRgb.b), true);
    }

    function lock() {
        locked = true;
    }

    function getHex() {
        return currentHex;
    }

    return { reset, lock, getHex };
}

