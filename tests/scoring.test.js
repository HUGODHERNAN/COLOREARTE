import {
    buildScoringRuleSummary,
    formatScore,
    getAverageAccuracy,
    scoreRound,
    sortFinalStandings
} from '../src/domain/scoring.js';
import { assert, suite } from './testRunner.js';

suite('domain/scoring', (test) => {
    test('formatScore formats numbers with 1 fixed decimal', () => {
        assert.equal(formatScore(0), '0.0');
        assert.equal(formatScore(85.94), '85.9');
        assert.equal(formatScore(undefined), '0.0');
    });

    test('buildScoringRuleSummary explains decimal similarity points', () => {
        const summary = buildScoringRuleSummary();
        assert.ok(summary.includes('85.9%'));
    });

    test('scoreRound ranks guesses descending and awards similarity as points', () => {
        const ranking = scoreRound('#FF5733', ['p1', 'p2', 'p3'], {
            p1: { hex: '#0000FF' },
            p2: { hex: '#FF5733' }
            // p3 intentionally missing -> falls back to #808080
        });

        assert.equal(ranking[0].playerId, 'p2');
        assert.equal(ranking[0].similarity, 100);
        assert.equal(ranking[0].pointsEarned, 100);
        assert.equal(ranking[0].rank, 1);

        assert.equal(ranking[2].playerId, 'p1');
        assert.equal(ranking[2].rank, 3);
        assert.equal(ranking[1].hex, '#808080');
    });

    test('sortFinalStandings sorts by score then breaks ties by totalAccuracy', () => {
        const sorted = sortFinalStandings([
            { id: 'a', score: 150.0, totalAccuracy: 140.0 },
            { id: 'b', score: 150.0, totalAccuracy: 160.0 },
            { id: 'c', score: 180.5, totalAccuracy: 180.5 }
        ]);
        assert.deepEqual(sorted.map(p => p.id), ['c', 'b', 'a']);
    });

    test('getAverageAccuracy handles 0 rounds and multiple rounds', () => {
        assert.equal(getAverageAccuracy({ roundsPlayed: 0, totalAccuracy: 0 }), '0.0');
        assert.equal(getAverageAccuracy({ roundsPlayed: 4, totalAccuracy: 350.0 }), '87.5');
    });
});

