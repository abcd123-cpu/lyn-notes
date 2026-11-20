"use strict";
(() => {
  const $ = selector => document.querySelector(selector);
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const subjects = [
    { key: "english", name: "英语四级", en: "ENGLISH", icon: "Aa", color: "green" },
    { key: "theory", name: "专业课理论", en: "THEORY", icon: "▤", color: "lavender" },
    { key: "practice", name: "专业课实操", en: "PRACTICE", icon: "◇", color: "peach" },
    { key: "math", name: "数学", en: "MATHEMATICS", icon: "ƒ", color: "blue" }
  ];
  const utc = date => Date.parse(date + "T00:00:00Z");
  const dateKey = date => date.toISOString().slice(0, 10);
  const shift = (date, days) => dateKey(new Date(utc(date) + days * 86400000));
  const shanghaiToday = () => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const validDate = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(utc(value)) && dateKey(new Date(utc(value))) === value;
  let today = shanghaiToday();
  let selected = today;
  let month = today.slice(0, 7);
  let limit = 6;
  const data = window.STUDY_DATA;
  const ready = data && data.version === 1 && Array.isArray(data.entries) && validDate(data.examDate);
  $("#data-error").hidden = Boolean(ready);
  const realEntries = ready ? data.entries : [];
  const examDate = ready ? data.examDate : "2027-03-20";
  const total = entry => subjects.reduce((sum, subject) => sum + (entry?.subjects[subject.key]?.minutes || 0), 0);
  const active = subject => subject && (subject.minutes > 0 || subject.items.length > 0);
  const entries = () => realEntries.filter(entry => entry.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  const hours = minutes => (minutes / 60).toLocaleString("zh-CN", { maximumFractionDigits: 1 });
  const weekday = date => new Intl.DateTimeFormat("zh-CN", { weekday: "long", timeZone: "UTC" }).format(new Date(utc(date)));

  const planLabels = { study: "学习安排", review: "复习安排", rest: "休息 / 娱乐", other: "其他安排" };
  const plansFor = entry => entry?.plans || (entry?.tomorrow || []).map(text => ({ type: "other", text }));
  const unknownTime = entry => subjects.some(s => entry?.subjects[s.key]?.minutes === null);
  function planList(plans) {
    const list = el("ul", "plan-list");
    plans.forEach(plan => { const row = el("li", "plan-item"); row.append(el("span", `plan-tag ${plan.type === "rest" ? "rest" : ""}`, planLabels[plan.type] || planLabels.other), el("span", "", plan.text)); list.append(row); });
    return list;
  }

  function renderCountdown() {
    const difference = Math.round((utc(examDate) - utc(today)) / 86400000);
    $("#days-left").textContent = Math.abs(difference);
    $("#countdown-label").textContent = difference > 0 ? "距离考试还有" : difference === 0 ? "就是今天，平静上场" : "距离考试已过去";
    $("#exam-date").textContent = `${examDate.replace(/-0?/g, " / ")} · ${weekday(examDate)}`;
    $("#sidebar-exam").textContent = `目标日 · ${examDate.replaceAll("-", ".")}`;
    $("#today-label").textContent = `${today.replaceAll("-", ".")} ${weekday(today)}`;
    $("#today-label").dateTime = today;
  }

  function metric(selector, value, unit) { $(selector).replaceChildren(document.createTextNode(String(value)), el("small", "", ` ${unit}`)); }
  function renderStats() {
    const list = entries();
    const minutes = list.reduce((sum, entry) => sum + total(entry), 0);
    const dates = new Set(list.map(entry => entry.date));
    let cursor = dates.has(today) ? today : shift(today, -1), streak = 0;
    while (dates.has(cursor)) { streak++; cursor = shift(cursor, -1); }
    const weekStart = shift(today, -((new Date(utc(today)).getUTCDay() + 6) % 7));
    const week = list.filter(entry => entry.date >= weekStart);
    const weekMinutes = week.reduce((sum, entry) => sum + total(entry), 0);
    metric("#total-hours", hours(minutes), "小时"); metric("#total-days", list.length, "天"); metric("#streak", streak, "天"); metric("#week-hours", hours(weekMinutes), "小时");
    $("#total-minutes").textContent = minutes ? `已填 ${minutes.toLocaleString("zh-CN")} 分钟${list.some(unknownTime) ? " · 部分时长未填" : "的专注"}` : "从第一分钟开始";
    $("#week-caption").textContent = `本周已有 ${week.length} 天留下记录`;
    $("#week-total").textContent = `共 ${weekMinutes} 分钟`;
    $("#week-range").textContent = `${weekStart.replaceAll("-", ".")} — ${shift(weekStart, 6).replaceAll("-", ".")}`;
    $("#week-view-hours").textContent = `${hours(weekMinutes)} 小时`;
    $("#week-view-days").textContent = `${week.length} 天记录${week.some(unknownTime) ? " · 部分时长未填" : ""}`;
    $("#last-update").textContent = list.length ? `最近更新 · ${list[0].date}` : "学习足迹，慢慢积累";
    const dailyMinutes = Array.from({ length: 7 }, (_, i) => total(week.find(entry => entry.date === shift(weekStart, i))));
    const max = Math.max(...dailyMinutes, 1);
    $("#weekly-chart").replaceChildren(...dailyMinutes.map((value, i) => {
      const column = el("div", `bar-column${shift(weekStart, i) === today ? " current" : ""}`);
      const bar = el("div", "bar"); bar.style.height = `${Math.max(3, value / max * 78)}%`;
      column.append(el("span", "bar-value", value || ""), bar, el("span", "bar-label", "一二三四五六日"[i]));
      column.title = `${shift(weekStart, i)} · ${value} 分钟`;
      return column;
    }));
    $("#weekly-chart").setAttribute("aria-label", dailyMinutes.map((value, i) => `星期${"一二三四五六日"[i]} ${value} 分钟`).join("，"));
    $("#chart-caption").textContent = weekMinutes ? "不必每天一样多，找到适合自己的节奏。" : "从一次小小的专注开始。";
    $("#distribution").replaceChildren(...subjects.map(subject => {
      const value = week.reduce((sum, entry) => sum + entry.subjects[subject.key].minutes, 0);
      const percent = weekMinutes ? Math.round(value / weekMinutes * 100) : 0;
      const row = el("div", "distribution-row"), track = el("div", "distribution-track"), fill = el("div", "distribution-fill");
      fill.style.width = `${percent}%`; fill.style.background = `var(--${subject.key})`; track.append(fill);
      row.append(el("span", "", subject.name), track, el("span", "", `${percent}%`)); row.title = `${subject.name}：${value} 分钟`; return row;
    }));
  }

  function renderDay() {
    const entry = entries().find(item => item.date === selected);
    $("#day-picker").value = selected;
    $("#daily-title").textContent = selected === today ? "今天，也有在进步" : "这一天，留下了什么";
    $("#day-mood").textContent = entry ? "慢慢积累" : "待更新";
    $("#day-summary").textContent = entry ? `${unknownTime(entry) ? "已填" : "共"} ${total(entry)} 分钟 · ${subjects.filter(s => active(entry.subjects[s.key])).length} 个科目` : "暂无学习内容";
    $("#previous-day").disabled = selected <= "2000-01-01";
    $("#next-day").disabled = selected >= today;
    $("#daily-empty").hidden = Boolean(entry);
    $("#subject-grid").replaceChildren(...subjects.map(subject => {
      const record = entry?.subjects[subject.key];
      const card = el("article", `subject-card${active(record) ? "" : " subject-empty"}`), top = el("div", "subject-top"), heading = el("div");
      heading.append(el("h3", "", subject.name), el("small", "", subject.en));
      top.append(el("span", `subject-icon ${subject.color}`, subject.icon), heading, el("span", "subject-time", record?.minutes === null ? "未提供时长" : `${record?.minutes || 0} 分钟`)); card.append(top);
      if (record?.items.length) {
        const list = el("ul", "subject-list");
        record.items.forEach(item => {
          const row = el("li", item.done === false ? "task-pending" : "");
          const mark = el("span", "task-mark", item.done === true ? "✓" : item.done === false ? "□" : "·"); mark.setAttribute("aria-label", item.done === true ? "已完成" : item.done === false ? "待完成" : "记录");
          row.append(mark, el("span", "", item.text)); list.append(row);
        }); card.append(list);
      }
      const bottom = el("div", "subject-bottom"); bottom.append(el("span", "", active(record) ? `${record.items.length} 条学习记录` : "暂无学习内容"), el("span", "", "✧")); card.append(bottom); return card;
    }));
    $("#day-notes").replaceChildren();
    if (entry?.summary) {
      const summary = el("section", "day-note");
      summary.append(el("h3", "", "今日小结 · AI 整理"), el("p", "", entry.summary));
      $("#day-notes").append(summary);
    }
    if (plansFor(entry).length) {
      const note = el("section", "day-note tomorrow-note");
      note.append(el("h3", "", "明日计划"), planList(plansFor(entry)));
      $("#day-notes").append(note);
    }
  }

  function selectDate(date, scroll = false) {
    if (!validDate(date) || date > today || date < "2000-01-01") return;
    selected = date; month = date.slice(0, 7); renderDay(); renderCalendar();
    if (scroll) {
      if (phoneLayout.matches) navigateMobile("daily");
      else $("#daily").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }
  function renderCalendar() {
    const first = new Date(utc(month + "-01"));
    const year = first.getUTCFullYear(), monthNumber = first.getUTCMonth();
    const offset = (first.getUTCDay() + 6) % 7, count = new Date(Date.UTC(year, monthNumber + 1, 0)).getUTCDate();
    $("#calendar-month").textContent = `${year} 年 ${monthNumber + 1} 月`;
    $("#previous-month").disabled = month <= "2000-01";
    $("#next-month").disabled = month >= today.slice(0, 7);
    const recorded = new Set(entries().map(entry => entry.date)), nodes = [];
    for (let i = 0; i < offset; i++) nodes.push(el("span"));
    for (let day = 1; day <= count; day++) {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      const button = el("button", `calendar-day${recorded.has(date) ? " recorded" : ""}${date === today ? " today" : ""}${date === selected ? " selected" : ""}${date > today ? " future" : ""}`, day);
      button.type = "button"; button.disabled = date > today;
      button.setAttribute("aria-label", `${date}${recorded.has(date) ? "，有学习记录" : "，暂无记录"}`); button.setAttribute("aria-pressed", String(date === selected));
      if (date === today) button.setAttribute("aria-current", "date");
      button.addEventListener("click", () => selectDate(date, true)); nodes.push(button);
    }
    $("#calendar-grid").replaceChildren(...nodes);
  }

  function renderHistory() {
    const query = $("#history-search").value.trim().toLocaleLowerCase(), filter = $("#subject-filter").value;
    const matching = entries().filter(entry => {
      const scope = subjects.filter(s => filter === "all" || s.key === filter);
      if (filter !== "all" && !active(entry.subjects[filter])) return false;
      const text = [entry.date, ...scope.flatMap(s => entry.subjects[s.key].items.map(item => item.text)), ...(filter === "all" ? [entry.summary || "", ...plansFor(entry).map(plan => plan.text)] : [])].join(" ").toLocaleLowerCase();
      return text.includes(query);
    });
    $("#history-count").textContent = `${matching.length} 篇手记`;
    const nodes = matching.slice(0, limit).map(entry => {
      const row = el("article", "history-entry"), date = el("div", "history-date"), body = el("div", "history-body"), open = el("button", "history-open", `${entry.date} · ${weekday(entry.date)}`);
      date.append(el("strong", "", entry.date.slice(8)), el("span", "", `${Number(entry.date.slice(5, 7))} 月`)); open.type = "button"; open.addEventListener("click", () => selectDate(entry.date, true));
      const scope = subjects.filter(s => filter === "all" || s.key === filter);
      const preview = scope.flatMap(s => entry.subjects[s.key].items.map(item => item.text)).join("；") || entry.summary || plansFor(entry).map(plan => plan.text).join("；") || "为这一天，留下一点思考。";
      body.append(open, el("p", "", preview)); const tags = el("div", "history-tags"); subjects.filter(s => active(entry.subjects[s.key])).forEach(s => tags.append(el("span", "history-tag", s.name))); body.append(tags); row.append(date, body, el("span", "history-duration", `${total(entry)} 分钟`)); return row;
    });
    if (!nodes.length) { const empty = el("div", "history-empty"); empty.append(el("span", "", "✧"), el("p", "", query || filter !== "all" ? "没有找到这条足迹，试试其他关键词。" : "学习足迹会在这里慢慢积累。每一小步，都算数。")); nodes.push(empty); }
    $("#history-list").replaceChildren(...nodes); $("#load-more").hidden = matching.length <= limit;
  }

  // Only phones use separate views. Desktop keeps the complete dashboard.
  const phoneLayout = matchMedia("(max-width: 760px)");
  const viewTitles = { overview: "#welcome-title", daily: "#daily-title", week: "#week-view-title", history: "#history-title" };
  const viewFromHash = () => Object.hasOwn(viewTitles, location.hash.slice(1)) ? location.hash.slice(1) : "overview";
  function syncMobileView(focus = false) {
    const view = viewFromHash();
    document.body.dataset.mobilePage = view;
    document.querySelectorAll("[data-nav-view]").forEach(link => {
      const current = link.dataset.navView === (phoneLayout.matches ? view : "overview");
      link.classList.toggle("active", current);
      if (current) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    if (phoneLayout.matches && focus) {
      $(viewTitles[view]).focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }
  function navigateMobile(view) {
    if (location.hash !== `#${view}`) location.hash = view;
    syncMobileView(true);
  }
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    const view = link.getAttribute("href").slice(1);
    if (!Object.hasOwn(viewTitles, view)) return;
    link.addEventListener("click", event => {
      if (!phoneLayout.matches || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      // The Today navigation always returns to today's journal after viewing an older day.
      if (view === "daily") selectDate(today);
      navigateMobile(view);
    });
  });
  window.addEventListener("hashchange", () => syncMobileView(true));
  phoneLayout.addEventListener("change", () => syncMobileView(true));
  syncMobileView();

  function renderAll() { renderCountdown(); renderStats(); renderDay(); renderCalendar(); renderHistory(); }
  $("#day-picker").max = today;
  $("#day-picker").addEventListener("change", event => { selectDate(event.target.value); event.target.value = selected; });
  $("#previous-day").addEventListener("click", () => selectDate(shift(selected, -1)));
  $("#next-day").addEventListener("click", () => selectDate(shift(selected, 1)));
  $("#go-today").addEventListener("click", () => selectDate(today));
  const changeMonth = amount => { const date = new Date(utc(month + "-01")); date.setUTCMonth(date.getUTCMonth() + amount); month = dateKey(date).slice(0, 7); renderCalendar(); };
  $("#previous-month").addEventListener("click", () => changeMonth(-1)); $("#next-month").addEventListener("click", () => changeMonth(1));
  $("#calendar-today").addEventListener("click", () => { month = today.slice(0, 7); renderCalendar(); });
  ["#history-search", "#subject-filter"].forEach(selector => $(selector).addEventListener(selector === "#history-search" ? "input" : "change", () => { limit = 6; renderHistory(); }));
  $("#load-more").addEventListener("click", () => { limit += 6; renderHistory(); });
  function theme(value) { document.documentElement.dataset.theme = value; $("#theme-toggle").textContent = value === "dark" ? "☼" : "☾"; $("#theme-toggle").setAttribute("aria-label", value === "dark" ? "切换到浅色主题" : "切换到深色主题"); document.querySelector('meta[name="theme-color"]').content = value === "dark" ? "#131e2c" : "#f3f7fc"; }
  try { theme(localStorage.getItem("study-theme") === "dark" ? "dark" : "light"); } catch { theme("light"); }
  $("#theme-toggle").addEventListener("click", () => { const value = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; theme(value); try { localStorage.setItem("study-theme", value); } catch { /* Theme remains usable when browser storage is unavailable. */ } });
  function checkDay() { const current = shanghaiToday(); if (current !== today) { const wasToday = selected === today; today = current; $("#day-picker").max = today; if (wasToday) { selected = today; month = today.slice(0, 7); } renderAll(); } }
  setInterval(checkDay, 60000); document.addEventListener("visibilitychange", () => { if (!document.hidden) checkDay(); });
  renderAll();
})();
