import joplin from "api";
import { noteoverview, logging } from "../src/noteoverview";
import { when } from "jest-when";

const spyOnGlobalValue = jest.spyOn(joplin.settings, "globalValue");
const spyOnValue = jest.spyOn(joplin.settings, "value");

const spyOnJoplinDataGet = jest.spyOn(joplin.data, "get");
let origNotes = {
  items: [
    {
      id: "n1",
      title: "note1",
      is_todo: 0,
      parent_id: "nb1",
      body: `<!-- note-overview-plugin
search: type:todo
fields: title, notebook
-->`,
    },

    {
      id: "t1",
      title: "todo1",
      body: "",
      is_todo: 1,
      parent_id: "nb2",
    },
    { id: "t2", title: "todo2", body: "", is_todo: 1, parent_id: "nb3" },
    { id: "t3", title: "todo3", body: "", is_todo: 1, parent_id: "nb3" },
  ],
  has_more: false,
};
let notes = Object.assign({}, origNotes);

const folders = {
  items: [
    { id: "nb1", title: "notebook1" },
    { id: "nb2", title: "notebook2", parent_id: "nb1" },
    { id: "nb3", title: "notebook3", parent_id: "nb1" },
  ],
  has_more: false,
};

const tags = {
  items: [
    { id: "tg1", title: "tag1" },
    { id: "tg2", title: "tag2" },
    { id: "tg3", title: "tag3" },
  ],
  has_more: false,
};

const notesTags = {
  items: [
    { tagId: "tg1", noteId: "t1" },
    { tagId: "tg2", noteId: "t1" },
    { tagId: "tg1", noteId: "t2" },
    { tagId: "tg3", noteId: "t3" },
  ],
  has_more: false,
};

describe("split function", function () {
  beforeEach(async () => {
    jest.spyOn(logging, "silly").mockImplementation(() => {});
    jest.spyOn(logging, "verbose").mockImplementation(() => {});
    jest.spyOn(logging, "info").mockImplementation(() => {});

    when(spyOnGlobalValue)
      .mockImplementation(() => Promise.resolve("no mockImplementation"))
      .calledWith("locale")
      .mockImplementation(() => Promise.resolve("en"));

    when(spyOnValue)
      .mockImplementation(() => Promise.resolve("no mockImplementation"))
      .calledWith("showNoteCount")
      .mockImplementation(() => Promise.resolve("off"))
      .calledWith("showNoteCountText")
      .mockImplementation(() => Promise.resolve("Note count: {{count}}"))
      .calledWith("noteStatus")
      .mockImplementation(() => Promise.resolve(""))
      .calledWith("todoStatusOpen")
      .mockImplementation(() => Promise.resolve(""))
      .calledWith("todoStatusOverdue")
      .mockImplementation(() => Promise.resolve("❗"))
      .calledWith("todoStatusDone")
      .mockImplementation(() => Promise.resolve("✔"));

    when(spyOnJoplinDataGet)
      .mockImplementation(() => Promise.resolve("no mockImplementation"))
      // folders
      .calledWith(expect.arrayContaining(["folders"]), expect.anything())
      .mockImplementation(() => Promise.resolve(folders))
      // search
      .calledWith(expect.arrayContaining(["search"]), expect.anything())
      .mockImplementation(async (path: string[], query: any) => {
        let result = notes;
        if (query.query == '/"<!-- note-overview-plugin"') {
          result = { items: [notes.items[0]], has_more: false };
        }
        if (query.query.includes("type:todo")) {
          if (query.query.includes("notebook:")) {
            const folder_item = folders.items.filter((value) => {
              let query_name = [
                ...query.query.match(/notebook:[^$\s]+/),
              ][0].split(":")[1];
              return value.title == query_name;
            })[0];
            result = {
              items: notes.items.filter(
                (note) => note.parent_id == folder_item.id
              ),
              has_more: false,
            };
          } else {
            result = {
              items: notes.items.filter((note) => !!note.is_todo),
              has_more: false,
            };
          }
        }
        return result;
      })
      // [notes, noteId, tags]
      .calledWith(
        expect.arrayContaining(["notes", expect.any(String), "tags"]),
        expect.anything()
      )
      .mockImplementation((path: string[], query: any) => {
        let result = { items: [], has_more: false };

        const _noteId = path[1];
        const _tagsId = notesTags.items
          .filter((value) => value.noteId == _noteId)
          .map((value) => value.tagId);
        result.items = tags.items.filter(
          (value) => _tagsId.indexOf(value.id) >= 0
        );
        return result;
      })
      // [notes, noteId]
      .calledWith(
        expect.arrayContaining(["notes", expect.any(String)]),
        expect.anything()
      )
      .mockImplementation((args) => {
        return notes.items.filter((value) => value.id == args[1])[0];
      });
  });

  afterEach(async () => {
    notes = Object.assign({}, origNotes);

    jest.spyOn(logging, "silly").mockReset();
    jest.spyOn(logging, "verbose").mockReset();
    jest.spyOn(logging, "info").mockReset();
    spyOnGlobalValue.mockReset();
    spyOnValue.mockReset();

    spyOnJoplinDataGet.mockReset();
  });

  it("no split", async () => {
    const spyOnGetQueries = jest.spyOn(noteoverview, "getQueries");
    await noteoverview.updateAll(false);

    expect(spyOnGetQueries.mock.results[0].value).resolves.toEqual({
      0: "type:todo",
    });

    spyOnGetQueries.mockClear();
  });

  it("split by notebook", async () => {
    notes.items[0].body = `<!-- note-overview-plugin
search: type:todo
fields: title, notebook
split:
  by: notebook
-->`;
    const spyOnGetQueries = jest.spyOn(noteoverview, "getQueries");
    await noteoverview.updateAll(false);

    expect(spyOnGetQueries.mock.results[0].value).resolves.toEqual({
      notebook2: "type:todo notebook:notebook2",
      notebook3: "type:todo notebook:notebook3",
    });

    spyOnGetQueries.mockClear();
  });

  it("split by breadcrumb", async () => {
    notes.items[0].body = `<!-- note-overview-plugin
search: type:todo
fields: title, breadcrumb
split:
  by: breadcrumb
-->`;
    const spyOnGetQueries = jest.spyOn(noteoverview, "getQueries");
    await noteoverview.updateAll(false);

    expect(spyOnGetQueries.mock.results[0].value).resolves.toEqual({
      notebook2: "type:todo notebook:notebook2",
      notebook3: "type:todo notebook:notebook3",
    });

    spyOnGetQueries.mockClear();
  });

  it("split by tags", async () => {
    notes.items[0].body = `<!-- note-overview-plugin
search: type:todo
fields: title, tags
split:
  by: tags
-->`;
    const spyOnGetQueries = jest.spyOn(noteoverview, "getQueries");
    await noteoverview.updateAll(false);

    expect(spyOnGetQueries.mock.results[0].value).resolves.toEqual({
      "tag1, tag2": "type:todo tag:tag1 tag:tag2 -tag:tag3",
      tag1: "type:todo tag:tag1 -tag:tag2 -tag:tag3",
      tag3: "type:todo tag:tag3 -tag:tag1 -tag:tag2",
    });

    spyOnGetQueries.mockClear();
  });

  it("split prefix", async () => {
    notes.items[0].body = `<!-- note-overview-plugin
search: type:todo
fields: title, notebook
split:
  by: notebook
  prefix: "## {{title}}"
-->`;
    const spyOnGetOverviewContentBlock = jest.spyOn(
      noteoverview,
      "getOverviewContentBlock"
    );
    await noteoverview.updateAll(false);

    for (let r of spyOnGetOverviewContentBlock.mock.results) {
      let value = await r.value;
      expect(value[0]).toMatch(/## notebook\d/);
    }

    spyOnGetOverviewContentBlock.mockClear();
  });

  it("split suffix", async () => {
    notes.items[0].body = `<!-- note-overview-plugin
search: type:todo
fields: title, notebook
split:
  by: notebook
  suffix: ---
-->`;
    const spyOnGetOverviewContentBlock = jest.spyOn(
      noteoverview,
      "getOverviewContentBlock"
    );
    await noteoverview.updateAll(false);

    for (let r of spyOnGetOverviewContentBlock.mock.results) {
      let value = await r.value;
      expect(value.slice(-1)[0]).toBe("---");
    }

    spyOnGetOverviewContentBlock.mockClear();
  });

  it("split with note count", async () => {
    spyOnValue.mockReset();
    when(spyOnValue)
      .calledWith("showNoteCount")
      .mockImplementation(() => Promise.resolve("on"))
      .calledWith("showNoteCountText")
      .mockImplementation(() => Promise.resolve("Note count: {{count}}"));

    notes.items[0].body = `<!-- note-overview-plugin
search: type:todo
fields: title, notebook
split:
  by: notebook
-->`;
    const spyOnGetOverviewContentBlock = jest.spyOn(
      noteoverview,
      "getOverviewContentBlock"
    );
    await noteoverview.updateAll(false);

    for (let r of spyOnGetOverviewContentBlock.mock.results) {
      let value = await r.value;
      expect(value.slice(-2)[0]).toMatch(/Note count: \d+/);
    }
    spyOnGetOverviewContentBlock.mockClear();
  });

  it("split with details", async () => {
    notes.items[0].body = `<!-- note-overview-plugin
search: type:todo
fields: title, notebook
split:
  by: notebook
details:
  open: false
  summary: "Note count: {{count}}"
-->`;
    const spyOnGetOverviewContentBlock = jest.spyOn(
      noteoverview,
      "getOverviewContentBlock"
    );
    await noteoverview.updateAll(false);

    for (let r of spyOnGetOverviewContentBlock.mock.results) {
      let value = await r.value;
      expect(value[0]).toMatch(/<details [^>]+>/);
      expect(value[1]).toMatch(/<summary>Note count: \d+<\/summary>/);
    }
    spyOnGetOverviewContentBlock.mockClear();
  });

  it("split with listview", async () => {
    notes.items[0].body = `<!-- note-overview-plugin
search: type:todo
fields: title, notebook
split:
  by: notebook
listview:
  text: "{{title}}"
-->`;
    const spyOnGetOverviewContentBlock = jest.spyOn(
      noteoverview,
      "getOverviewContentBlock"
    );
    await noteoverview.updateAll(false);

    for (let r of spyOnGetOverviewContentBlock.mock.results) {
      let value = await r.value;
      expect(value[0]).toMatch(/\[[^\]]+\]\(:\/[^\)]+\)/);
    }
    spyOnGetOverviewContentBlock.mockClear();
  });
});
