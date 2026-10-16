import assert from "node:assert/strict";
import { test } from "node:test";
import { resolve } from "node:path";

// Resolve the pinned development dependency, never a maintainer's Pi installation.
const piEntry = import.meta.resolve("@earendil-works/pi-coding-agent");
const { loadExtensions } = await import(new URL("./core/extensions/loader.js", piEntry));
const file = process.env.PI_TIMER_EXTENSION_PATH ?? resolve(import.meta.dirname, "index.ts");

async function harness(t, mode = "tui") {
  const loaded = await loadExtensions([file], process.cwd());
  assert.deepEqual(loaded.errors, []);
  assert.equal(loaded.extensions.length, 1);
  const handlers = loaded.extensions[0].handlers;
  let now = 0;
  let working;
  let widget;
  let placement;
  const intervals = new Map();
  t.mock.method(performance, "now", () => now);
  t.mock.method(globalThis, "setInterval", (fn, delay) => {
    assert.equal(delay, 1000);
    const handle = { unref() {} };
    intervals.set(handle, fn);
    return handle;
  });
  t.mock.method(globalThis, "clearInterval", (handle) => intervals.delete(handle));
  t.mock.timers.enable({ apis: ["Date"], now: new Date(2026, 0, 2, 14, 32, 5).getTime() });
  const ctx = { mode, ui: {
    setWorkingMessage(value) { working = value; },
    setWidget(key, value, options) {
      assert.equal(key, "response-timer");
      widget = value;
      placement = options?.placement;
    },
  } };
  return {
    async emit(type, event = {}) {
      for (const handler of handlers.get(type) ?? []) await handler({ type, ...event }, ctx);
    },
    advance(ms) {
      now += ms;
      t.mock.timers.tick(ms);
      for (const fn of intervals.values()) fn();
    },
    get working() { return working; },
    get widget() { return widget; },
    get placement() { return placement; },
    get timers() { return intervals.size; },
  };
}

test("real loader; submission-to-settlement; replaces previous result", async (t) => {
  const h = await harness(t);
  await h.emit("session_start");
  await h.emit("input");
  h.advance(2000); // Input preprocessing/compaction is included.
  await h.emit("before_agent_start", { messageType: "user" });
  assert.equal(h.working, "Working... 02s");
  h.advance(21000);
  assert.equal(h.working, "Working... 23s");
  await h.emit("agent_end");
  assert.equal(h.timers, 1);
  await h.emit("input", { streamingBehavior: "steer" });
  await h.emit("agent_start");
  await h.emit("before_agent_start", { messageType: "user" });
  h.advance(13000);
  await h.emit("agent_settled", { aborted: false });
  assert.deepEqual(h.widget, ["14:32:41 · 36s"]);
  assert.equal(h.placement, "aboveEditor");
  assert.equal(h.working, undefined);
  assert.equal(h.timers, 0);
  await h.emit("agent_settled"); // Idempotent, does not erase the result.
  assert.deepEqual(h.widget, ["14:32:41 · 36s"]);
  await h.emit("input");
  await h.emit("before_agent_start", { messageType: "user" });
  assert.equal(h.widget, undefined);
  assert.equal(h.working, "Working... 00s");
  h.advance(1000);
  await h.emit("agent_settled");
  assert.deepEqual(h.widget, ["14:32:42 · 01s"]);
});

test("abort and shutdown/reload clear timers and UI", async (t) => {
  const h = await harness(t);
  await h.emit("input");
  await h.emit("before_agent_start", { messageType: "user" });
  h.advance(5000);
  await h.emit("agent_settled", { aborted: true });
  assert.deepEqual(h.widget, ["14:32:10 · 05s"]);
  assert.equal(h.timers, 0);
  await h.emit("input");
  await h.emit("before_agent_start", { messageType: "user" });
  await h.emit("session_shutdown");
  assert.equal(h.timers, 0);
  assert.equal(h.widget, undefined);
  assert.equal(h.working, undefined);
  await h.emit("session_shutdown");
  await h.emit("session_start");
  await h.emit("agent_settled");
  assert.equal(h.widget, undefined);
});

test("handled input does not leak a timer or contaminate the next submission", async (t) => {
  const h = await harness(t);
  await h.emit("input");
  h.advance(60000);
  assert.equal(h.timers, 0);
  await h.emit("input");
  await h.emit("before_agent_start", { messageType: "user" });
  assert.equal(h.working, "Working... 00s");
  await h.emit("agent_settled");
  assert.deepEqual(h.widget, ["14:33:05 · 00s"]);
});

test("custom run falls back to its own start and formats minutes", async (t) => {
  const h = await harness(t);
  await h.emit("input");
  h.advance(5000);
  await h.emit("before_agent_start", { messageType: "custom" });
  assert.equal(h.working, "Working... 00s");
  h.advance(65000);
  assert.equal(h.working, "Working... 01m05s");
  await h.emit("agent_settled");
  assert.deepEqual(h.widget, ["14:33:15 · 01m05s"]);
});

test("wall-clock adjustments do not change elapsed time", async (t) => {
  const h = await harness(t);
  await h.emit("input");
  await h.emit("before_agent_start", { messageType: "user" });
  h.advance(5000);
  t.mock.timers.setTime(new Date(2026, 0, 2, 13, 0, 0).getTime());
  await h.emit("agent_settled");
  assert.deepEqual(h.widget, ["13:00:00 · 05s"]);
});

test("duration omits leading zero units and handles minute/hour boundaries", async (t) => {
  const cases = [
    [0, "00s"],
    [59999, "59s"],
    [60000, "01m00s"],
    [700000, "11m40s"],
    [3599999, "59m59s"],
    [3600000, "01h00m00s"],
    [3661000, "01h01m01s"],
    [86400000, "24h00m00s"],
    [360000000, "100h00m00s"],
  ];
  for (const [ms, expected] of cases) {
    await t.test(`${ms}ms -> ${expected}`, async (child) => {
      const h = await harness(child);
      await h.emit("input");
      await h.emit("before_agent_start", { messageType: "user" });
      h.advance(ms);
      assert.equal(h.working, `Working... ${expected}`);
      await h.emit("agent_settled");
      assert.equal(h.widget.length, 1);
      assert.equal(h.widget[0].split(" · ")[1], expected);
      assert.equal(h.timers, 0);
    });
  }
});

test("non-TUI modes have no UI or timer side effects", async (t) => {
  const h = await harness(t, "rpc");
  await h.emit("session_start");
  await h.emit("input");
  await h.emit("before_agent_start", { messageType: "user" });
  h.advance(3000);
  await h.emit("agent_settled");
  await h.emit("session_shutdown");
  assert.equal(h.widget, undefined);
  assert.equal(h.working, undefined);
  assert.equal(h.timers, 0);
});
