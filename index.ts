import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const WIDGET = "response-timer";

/** One elapsed clock per foreground run, including tools, retries and continuations. */
export default function responseTimer(pi: ExtensionAPI) {
	let pendingStart: number | undefined;
	let startedAt: number | undefined;
	let timer: ReturnType<typeof setInterval> | undefined;

	function stopTimer() {
		if (timer !== undefined) clearInterval(timer);
		timer = undefined;
	}

	function duration() {
		const total = Math.max(0, Math.floor((performance.now() - startedAt!) / 1000));
		const hours = String(Math.floor(total / 3600)).padStart(2, "0");
		const minutes = String(Math.floor(total / 60) % 60).padStart(2, "0");
		const seconds = String(total % 60).padStart(2, "0");
		if (total >= 3600) return `${hours}h${minutes}m${seconds}s`;
		if (total >= 60) return `${minutes}m${seconds}s`;
		return `${seconds}s`;
	}

	function reset(ctx: ExtensionContext) {
		stopTimer();
		pendingStart = undefined;
		startedAt = undefined;
		if (ctx.mode !== "tui") return;
		ctx.ui.setWorkingMessage();
		ctx.ui.setWidget(WIDGET, undefined);
	}

	pi.on("session_start", (_event, ctx) => reset(ctx));
	pi.on("session_shutdown", (_event, ctx) => reset(ctx));

	pi.on("input", (_event, ctx) => {
		if (ctx.mode === "tui" && startedAt === undefined) {
			// Capture submission time, but do not start a timer for input another
			// extension may handle without invoking the agent. New input replaces it.
			pendingStart = performance.now();
		}
		return { action: "continue" };
	});

	pi.on("before_agent_start", (event, ctx) => {
		if (ctx.mode !== "tui" || startedAt !== undefined) return;
		startedAt = event.messageType === "user" ? (pendingStart ?? performance.now()) : performance.now();
		pendingStart = undefined;
		ctx.ui.setWidget(WIDGET, undefined);
		const update = () => ctx.ui.setWorkingMessage(`Working... ${duration()}`);
		update();
		timer = setInterval(update, 1000);
		timer.unref();
	});

	// agent_end is too early: automatic retry/compaction/queued work can follow it.
	pi.on("agent_settled", (_event, ctx) => {
		if (startedAt === undefined) {
			pendingStart = undefined;
			return;
		}
		const elapsed = duration();
		const end = new Date();
		const time = [end.getHours(), end.getMinutes(), end.getSeconds()]
			.map((value) => String(value).padStart(2, "0"))
			.join(":");
		stopTimer();
		startedAt = undefined;
		pendingStart = undefined;
		if (ctx.mode !== "tui") return;
		ctx.ui.setWorkingMessage();
		ctx.ui.setWidget(WIDGET, [`${time} · ${elapsed}`], { placement: "aboveEditor" });
	});
}
