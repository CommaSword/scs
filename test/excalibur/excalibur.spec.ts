import {File, FileSystem, MemoryFileSystem} from "kissfs";
import {Entries, Entry, Status} from "../../src/excalibur/entries";
import {User} from "../../src/session/users";
import {ExcaliburSecClass} from "../../src/excalibur/clearence";
import {expect} from 'chai';


function makeUser(clearence: ExcaliburSecClass): User {
    const result = new User({
        gender: "ADVANCED",
        name: "jane joe",
        key: 'j',
        excaliburClearance: "CONFIDENTIAL"
    });
    result.excaliburClearance = clearence;
    return result;
}

function makeEntryFile(status: Status, securityClass: ExcaliburSecClass, name: string, content: string) {
    return `---
status : ${status}
securityClass : ${securityClass}
name : ${name}
---
${content}`;
}

async function makeEntriesWithPreExistingFile(fileContent: string) {
    const fs: MemoryFileSystem = new MemoryFileSystem();
    await fs.saveFile('entries/zagzag.md', fileContent);
    const entries = new Entries(fs);
    await entries.init();
    return entries;
}

async function makeEntrieandFileSystem(): Promise<{ fs: MemoryFileSystem; entries: Entries }> {
    const fs: MemoryFileSystem = new MemoryFileSystem();
    await fs.ensureDirectory('entries');
    await fs.ensureDirectory('queries');
    const entries = new Entries(fs);
    await entries.init();
    return {fs, entries};
}

describe.only('excalibur module', () => {
    describe('init', () => {
        it('on empty file sytsem - throws', async () => {
            const fs: MemoryFileSystem = new MemoryFileSystem();
            const entries = new Entries(fs);
            try {
                await entries.init();
                expect.fail(null, 'Error', 'expected init to throw')
            } catch (e) {
            }
        });

        it('on non-empty file sytsem - passes', async () => {
            const fs: MemoryFileSystem = new MemoryFileSystem();
            await fs.saveFile('entries/foo.md', '');
            const entries = new Entries(fs);
            await entries.init();
        });

    });

    describe('open', () => {
        describe('pre-existing file', () => {

            it('does not find draft file', async () => {
                const entries = await makeEntriesWithPreExistingFile(makeEntryFile(Status.DRAFT, ExcaliburSecClass.CONFIDENTIAL, 'foo', 'bar'));
                const result = entries.open(makeUser(ExcaliburSecClass.CONFIDENTIAL), 'foo');
                expect(result).to.not.be.ok;
            });

            it('does not find query file', async () => {
                const entries = await makeEntriesWithPreExistingFile(makeEntryFile(Status.QUERY, ExcaliburSecClass.CONFIDENTIAL, 'foo', 'bar'));
                const result = entries.open(makeUser(ExcaliburSecClass.CONFIDENTIAL), 'foo');
                expect(result).to.not.be.ok;
            });

            it('finds entry file', async () => {
                const entries = await makeEntriesWithPreExistingFile(makeEntryFile(Status.ENTRY, ExcaliburSecClass.CONFIDENTIAL, 'foo', 'bar'));
                const result = entries.open(makeUser(ExcaliburSecClass.CONFIDENTIAL), 'foo');
                expect(result).to.eql('bar');
            });

            it('finds entry with whitespace before metadata', async () => {
                const entries = await makeEntriesWithPreExistingFile('\n  \t  ' + makeEntryFile(Status.ENTRY, ExcaliburSecClass.CONFIDENTIAL, 'foo', 'bar'));
                const result = entries.open(makeUser(ExcaliburSecClass.CONFIDENTIAL), 'foo');
                expect(result).to.eql('bar');
            });

            it('finds entry by case-insensitive name', async () => {
                const entries = await makeEntriesWithPreExistingFile(makeEntryFile(Status.ENTRY, ExcaliburSecClass.CONFIDENTIAL, 'FoO', 'bar'));
                const result = entries.open(makeUser(ExcaliburSecClass.CONFIDENTIAL), 'fOo');
                expect(result).to.eql('bar');
            });
        });
    });

    describe('query', () => {


        async function query(entries: Entries, fs: FileSystem) {
            const result = entries.query(makeUser(ExcaliburSecClass.CONFIDENTIAL), 'foo');
            await new Promise(r => setTimeout(r, 1));
            const children = await fs.loadDirectoryChildren('queries');
            expect(children).to.have.length(1);
            const file = children[0] as File;
            file.content = await fs.loadTextFile(file.fullPath);
            const entry = Entry.parse(file.content, file.fullPath);
            return {result, entry};
        }

        it('finds entry file', async () => {
            const {entries, fs} = await makeEntrieandFileSystem();
            expect(await fs.loadDirectoryChildren('queries')).to.have.length(0);
            const {result, entry} = await query(entries, fs);
            expect(entry.meta.status).to.eql(Status.QUERY);
            expect(entry.meta.securityClass).to.eql(ExcaliburSecClass.CONFIDENTIAL);
            entry.content = 'bar123';
            entry.meta.status = Status.ENTRY;
            await fs.saveFile(entry.path, entry.toString());
            expect(await result).to.eql('bar123');
        });

        describe('afterwards', () => {
            let entries: Entries;
            let fs: FileSystem;
            beforeEach('finds entry file', async () => {
                const enf = await makeEntrieandFileSystem();
                entries = enf.entries;
                fs = enf.fs;
                const {entry} = await query(entries, fs);
                entry.content = 'bar123';
                entry.meta.status = Status.ENTRY;
                await fs.saveFile(entry.path, entry.toString());
            });

            it('entry moves from queries to entries folder', async () => {
                // TODO ...
            });

        });
    });
});
