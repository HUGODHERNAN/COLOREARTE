const suites = [];

export function suite(name, fn) {
    const tests = [];
    const test = (testName, testFn) => tests.push({ name: testName, fn: testFn });
    fn(test);
    suites.push({ name, tests });
}

export const assert = {
    ok(value, message = 'Expected truthy value') {
        if (!value) throw new Error(message);
    },
    equal(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    },
    deepEqual(actual, expected, message) {
        const a = JSON.stringify(actual);
        const b = JSON.stringify(expected);
        if (a !== b) {
            throw new Error(message || `Expected ${b}, got ${a}`);
        }
    },
    closeTo(actual, expected, tolerance = 0.05, message) {
        if (Math.abs(actual - expected) > tolerance) {
            throw new Error(message || `Expected ${actual} to be within ${tolerance} of ${expected}`);
        }
    }
};

export async function runAllSuites() {
    const results = [];
    let passed = 0;
    let failed = 0;

    for (const s of suites) {
        const suiteCases = [];
        for (const t of s.tests) {
            try {
                await t.fn();
                passed += 1;
                suiteCases.push({ name: t.name, ok: true });
            } catch (err) {
                failed += 1;
                suiteCases.push({ name: t.name, ok: false, error: err?.message || String(err) });
            }
        }
        results.push({ suite: s.name, cases: suiteCases });
    }

    return { passed, failed, total: passed + failed, results };
}

