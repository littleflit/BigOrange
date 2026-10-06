import { describe, expect, it } from 'vitest';
import { createBigOrangeIgnoreMatcher, isIgnoredByBigOrangeMatchers } from '@/utils/bigorangeIgnore';

// test/unit/utils/bigorangeIgnore.test.ts

describe('.bigorangeignore', () => {
    it('supports comments, basename globs, root paths, directories, and double-star paths', () => {
        const matcher = createBigOrangeIgnoreMatcher(`
# generated content
*.tmp
/private.mp3
cache/
archive/**/draft?.flac
`);

        expect(matcher.isIgnored('album/note.tmp', false)).toBe(true);
        expect(matcher.isIgnored('private.mp3', false)).toBe(true);
        expect(matcher.isIgnored('album/private.mp3', false)).toBe(false);
        expect(matcher.isIgnored('cache', true)).toBe(true);
        expect(matcher.isIgnored('cache', false)).toBe(false);
        expect(matcher.isIgnored('archive/2025/demo/draft1.flac', false)).toBe(true);
    });

    it('lets later negated rules override earlier rules', () => {
        const matcher = createBigOrangeIgnoreMatcher(`
*.mp3
!keep.mp3
`);

        expect(matcher.isIgnored('music/drop.mp3', false)).toBe(true);
        expect(matcher.isIgnored('music/keep.mp3', false)).toBe(false);
    });

    it('supports escaped leading comment and negation markers', () => {
        const matcher = createBigOrangeIgnoreMatcher('\\#notes\n\\!demo');
        expect(matcher.isIgnored('#notes', false)).toBe(true);
        expect(matcher.isIgnored('!demo', false)).toBe(true);
    });

    it('applies nested matchers relative to their folder and lets child rules override parents', () => {
        const parent = createBigOrangeIgnoreMatcher('*.mp3');
        const child = createBigOrangeIgnoreMatcher('!keep.mp3\nlocal.flac', 'album/disc');

        expect(isIgnoredByBigOrangeMatchers([parent, child], 'album/disc/keep.mp3', false)).toBe(false);
        expect(isIgnoredByBigOrangeMatchers([parent, child], 'album/disc/drop.mp3', false)).toBe(true);
        expect(isIgnoredByBigOrangeMatchers([parent, child], 'album/disc/local.flac', false)).toBe(true);
        expect(isIgnoredByBigOrangeMatchers([parent, child], 'album/other/keep.mp3', false)).toBe(true);
    });
});
