window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-plugin-canvas",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");

		// ── styles ─────────────────────────────────────────────────────────────
		const CSS = `
.cv-panel{display:flex;flex-direction:column;gap:10px;height:100%;min-height:0;padding:12px 16px 20px;box-sizing:border-box;font-size:13px;color:var(--dsw-alias-label-primary,#222);}
.cv-head{display:flex;align-items:center;gap:10px;flex:none;min-width:0;}
.cv-title{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px;min-width:0;}
.cv-title-ico{color:var(--dsw-alias-label-secondary,#888);font-size:15px;font-weight:700;line-height:1;font-family:var(--ds-font-family-code,ui-monospace,Menlo,Consolas,monospace);}
.cv-count{flex:1 1 auto;color:var(--dsw-alias-label-secondary,#888);font-size:12px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.cv-privacy{display:inline-flex;align-items:center;gap:5px;flex:none;color:var(--dsw-alias-state-success-primary,#30a46c);font-size:11px;line-height:16px;padding:1px 8px;border:1px solid rgba(48,164,108,.35);border-radius:999px;background:rgba(48,164,108,.08);white-space:nowrap;}
.cv-btn{background:var(--dsw-alias-bg-layer-2,#f5f5f5);color:var(--dsw-alias-label-primary,#222);border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer;flex:none;}
.cv-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-1,#fff);}
.cv-btn:disabled{opacity:.5;cursor:default;}
.cv-error{flex:none;color:var(--dsw-alias-state-error-primary,#e5484d);font-size:12px;line-height:18px;word-break:break-all;}
.cv-empty{flex:1 1 0;min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--dsw-alias-label-secondary,#888);font-size:13px;line-height:20px;text-align:center;padding:24px;}
.cv-empty-ico{font-family:var(--ds-font-family-code,ui-monospace,Menlo,Consolas,monospace);font-size:22px;line-height:1;color:var(--dsw-alias-label-secondary,#888);}
.cv-empty-sub{color:var(--dsw-alias-label-secondary,#888);font-size:12px;line-height:18px;opacity:.85;}
.cv-main{flex:1 1 0;min-height:0;display:flex;flex-direction:column;gap:8px;overflow:auto;padding-right:4px;overscroll-behavior:contain;}
.cv-stage{position:relative;flex:1 1 0;min-height:420px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:12px;background:#fff;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06);}
.cv-frame{width:100%;height:100%;border:0;display:block;background:#fff;}
.cv-marker{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(229,72,77,.9);border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.35);color:#fff;font-size:11px;font-weight:700;line-height:18px;text-align:center;cursor:help;z-index:20;}
.cv-marker-note{position:absolute;left:14px;top:14px;min-width:160px;max-width:280px;padding:8px 10px;background:rgba(30,32,40,.92);color:#fff;border-radius:8px;font-size:11.5px;line-height:17px;box-shadow:0 4px 16px rgba(0,0,0,.25);z-index:30;white-space:pre-wrap;word-break:break-word;}
.cv-side{flex:none;display:flex;flex-direction:column;gap:6px;}
.cv-notes{flex:none;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:10px;background:var(--dsw-alias-bg-layer-1,#fff);padding:10px 12px;max-height:220px;overflow-y:auto;}
.cv-notes-title{color:var(--dsw-alias-label-secondary,#888);font-size:11px;font-weight:600;line-height:16px;margin-bottom:6px;letter-spacing:.04em;}
.cv-note{font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary,#222);padding:2px 0;border-bottom:1px dashed var(--dsw-alias-border-l1,#eee);}
.cv-note:last-child{border-bottom:none;}
.cv-foot{flex:none;display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--dsw-alias-label-secondary,#888);font-size:11px;line-height:16px;}
@media (max-width:760px){.cv-panel{padding:10px 10px 12px;}.cv-stage{min-height:320px;}}
`;

		// ── helpers ────────────────────────────────────────────────────────────
		function apiGet(path, params) {
			let url = path;
			if (params) {
				const keys = Object.keys(params);
				if (keys.length > 0) {
					url += "?" + keys.map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(params[k])).join("&");
				}
			}
			return fetch(url, { cache: "no-store" })
				.then((r) => r.json().catch(() => ({ ok: false, error: "HTTP " + r.status })))
				.then((j) => {
					if (!j || j.ok === false) throw new Error((j && j.error) || "请求失败");
					return j;
				});
		}

		function apiPost(path, body) {
			return fetch(path, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body || {}),
				cache: "no-store",
			})
				.then((r) => r.json().catch(() => ({ ok: false, error: "HTTP " + r.status })))
				.then((j) => {
					if (!j || j.ok === false) throw new Error((j && j.error) || "请求失败");
					return j;
				});
		}

		function formatTime(ms) {
			if (!ms) return "—";
			const d = new Date(ms);
			const p = (n) => String(n).padStart(2, "0");
			return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
		}

		// ── Canvas view ────────────────────────────────────────────────────────
		function CanvasView(props) {
			const sessionId = props.sessionId;
			const [data, setData] = React.useState(null);
			const [error, setError] = React.useState(null);
			const [busy, setBusy] = React.useState(false);
			const [openMarker, setOpenMarker] = React.useState(null);

			React.useEffect(() => {
				let stopped = false;
				let timerId = null;
				const refresh = () => {
					apiGet("/canvas-api/state", { session: sessionId }).then(
						(res) => { if (!stopped) { setData(res); setError(null); } },
						(err) => { if (!stopped) setError(String((err && err.message) || err)); },
					);
				};
				refresh();
				timerId = window.setInterval(refresh, 2000);
				return () => { stopped = true; if (timerId !== null) window.clearInterval(timerId); };
			}, [sessionId]);

			const onClear = () => {
				setBusy(true);
				apiPost("/canvas-api/clear", { session: sessionId }).then(
					(res) => { setData(res); setError(null); setOpenMarker(null); setBusy(false); },
					(err) => { setError(String((err && err.message) || err)); setBusy(false); },
				);
			};

			const onRefresh = () => {
				apiGet("/canvas-api/state", { session: sessionId }).then(
					(res) => { setData(res); setError(null); },
					(err) => setError(String((err && err.message) || err)),
				);
			};

			const state = data && data.state ? data.state : null;
			const hasHtml = !!(state && state.html);
			const annotations = state ? (state.annotations || []) : [];
			const notes = state ? (state.notes || []) : [];

			const markers = hasHtml ? annotations.map((a, i) => {
				const marker = React.createElement("div", {
					key: "m" + i,
					className: "cv-marker",
					style: { left: a.x + "%", top: a.y + "%" },
					onClick: (e) => { e.stopPropagation(); setOpenMarker(openMarker === i ? null : i); },
					title: a.note,
				}, String(i + 1));
				const tip = openMarker === i ? React.createElement("div", {
					key: "n" + i,
					className: "cv-marker-note",
					onClick: (e) => e.stopPropagation(),
				}, a.note) : null;
				return [marker, tip];
			}) : [];

			const frame = hasHtml
				? React.createElement("iframe", {
					className: "cv-frame",
					srcDoc: state.html,
					sandbox: "allow-scripts allow-modals allow-forms allow-popups",
					title: state.title || "Canvas preview",
				})
				: null;

			const stage = hasHtml
				? React.createElement("div", { className: "cv-stage" },
					frame,
					...markers.flat())
				: React.createElement("div", { className: "cv-empty" },
					React.createElement("div", { className: "cv-empty-ico" }, "◫"),
					React.createElement("div", null, "画布为空"),
					React.createElement("div", { className: "cv-empty-sub" }, "会话智能体可通过 canvas_preview 工具渲染 HTML 设计稿到此处"));

			const notesPanel = notes.length > 0
				? React.createElement("div", { className: "cv-notes" },
					React.createElement("div", { className: "cv-notes-title" }, "备注"),
					notes.map((n, i) => React.createElement("div", { className: "cv-note", key: "note" + i }, "• " + n)))
				: null;

			const updated = state && state.updatedAt ? formatTime(state.updatedAt) : null;

			return React.createElement("div", { className: "cv-panel" },
				React.createElement("div", { className: "cv-head" },
					React.createElement("div", { className: "cv-title" },
						React.createElement("span", { className: "cv-title-ico" }, "◫"),
						React.createElement("span", null, "画布"),
						React.createElement("span", { className: "cv-privacy" }, "隐私脱敏")),
					React.createElement("span", { className: "cv-count" },
						state && state.title ? state.title : (hasHtml ? "已渲染" : "未渲染")),
					React.createElement("button", { type: "button", className: "cv-btn", onClick: onRefresh, disabled: busy }, "刷新"),
					React.createElement("button", { type: "button", className: "cv-btn", onClick: onClear, disabled: busy || !hasHtml }, "清空")),
				error ? React.createElement("div", { className: "cv-error" }, "⚠ " + error) : null,
				React.createElement("div", { className: "cv-main" }, stage, notesPanel),
				React.createElement("div", { className: "cv-foot" },
					React.createElement("span", null, state && state.sourceLabel ? "来源 " + state.sourceLabel : "仅当前会话 · 不落盘"),
					React.createElement("span", null, updated ? "更新于 " + updated : "等待渲染")));
		}

		// ── plugin entry ────────────────────────────────────────────────────────
		const inject = ["slots"];

		function apply(ctx) {
			const slots = ctx.get("slots");
			if (slots === undefined) return;
			const style = document.createElement("style");
			style.dataset.plugin = "@deepseek-ai/dsh-plugin-canvas";
			style.dataset.pluginCss = "@deepseek-ai/dsh-plugin-canvas/styles";
			style.textContent = CSS;
			ctx.effect(() => {
				document.head.appendChild(style);
				return () => {
					style.remove();
				};
			}, "canvas: styles");
			slots.inject("conversation.view", () => slots.register(
				{ name: "conversation.view", id: "canvas", order: 13, label: () => "画布" },
				(props) => React.createElement(CanvasView, Object.assign({}, props, { ctx }))
			));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
