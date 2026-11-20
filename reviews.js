"use strict";
(() => {
  const $ = selector => document.querySelector(selector);
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const names = { english: "英语四级", theory: "专业课理论", practice: "专业课实操", math: "数学" };
  const types = { study: "学习安排", review: "复习安排", rest: "休息 / 娱乐", other: "其他安排" };
  const data = window.STUDY_DATA;
  const ready = data?.version === 1 && Array.isArray(data.weeklyReviews);
  const timestamp = value => Date.parse(value.replace(/(\.\d{3})\d+(?=Z|[+-]\d{2}:\d{2}$)/, "$1"));
  const allReports = [...(ready ? data.weeklyReviews : [])].sort((a, b) => b.start.localeCompare(a.start) || timestamp(b.generatedAt) - timestamp(a.generatedAt) || b.generatedAt.localeCompare(a.generatedAt) || b.id.localeCompare(a.id));
  // Keep the complete archive in data, but expose only the newest report for each week.
  const byWeek = new Map();
  allReports.forEach(report => { if (!byWeek.has(report.start)) byWeek.set(report.start, report); });
  const reports = [...byWeek.values()];
  const shortDate = value => value.slice(5).replace("-", ".");
  const dateRange = report => `${shortDate(report.start)} — ${shortDate(report.end)}`;
  const generated = value => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(timestamp(value)));
  let selected = null, limit = 8;
  const requestedId = () => {
    const id = new URLSearchParams(location.hash.slice(1)).get("report");
    const saved = allReports.find(report => report.id === id);
    return saved ? byWeek.get(saved.start).id : null;
  };
  $("#review-data-error").hidden = ready;
  $("#report-total").textContent = reports.length;
  $("#week-total").textContent = `留存 ${reports.length} 周的记录`;
  reports.forEach(report => {
    const option = el("option", "", `${dateRange(report)}${report.start.slice(0, 4) !== reports[0].start.slice(0, 4) ? " · " + report.start.slice(0, 4) : ""}`);
    option.value = report.id; $("#mobile-report-select").append(option);
  });
  $("#mobile-week-picker").hidden = reports.length === 0;
  [...new Set(reports.map(report => report.start.slice(0, 7)))].sort().reverse().forEach(month => {
    const option = el("option", "", `${month.slice(0, 4)} 年 ${Number(month.slice(5))} 月`); option.value = month; $("#review-month").append(option);
  });

  function matching() {
    const text = $("#review-search").value.trim().toLocaleLowerCase();
    const month = $("#review-month").value;
    return reports.filter(report => {
      const subjects = Object.entries(names).filter(([key]) => report.subjectMinutes[key] > 0).map(([, name]) => name);
      const searchable = [report.start, report.end, report.nextWeekStart, dateRange(report), generated(report.generatedAt), report.summary, ...report.suggestions.map(item => item.text), ...subjects].join(" ").toLocaleLowerCase();
      return (month === "all" || report.start.startsWith(month)) && searchable.includes(text);
    });
  }
  function renderDetail(report) {
    $("#review-detail").hidden = !report;
    if (!report) return;
    $("#detail-title").textContent = `${dateRange(report)} 的一周`;
    $("#detail-period").textContent = `${report.start} 至 ${report.end}${report.end < shift(report.start, 6) ? " · 阶段回顾" : ""}`;
    $("#detail-badge").textContent = "AI 生成";
    $("#detail-days").textContent = `${report.recordedDays} 天`;
    $("#detail-duration").textContent = `${report.totalMinutes} 分钟`;
    $("#detail-through").textContent = shortDate(report.end);
    $("#detail-subjects").replaceChildren(...Object.entries(names).map(([key, name]) => {
      const chip = el("span", "report-subject"); chip.append(el("span", "", name), el("strong", "", `${report.subjectMinutes[key]} 分钟`)); chip.style.setProperty("--subject-color", `var(--${key})`); return chip;
    }));
    if (report.hasUnknownTime) $("#detail-subjects").append(el("span", "missing-time", "部分时长未填写，仅统计已提供的时长。"));
    $("#detail-summary").textContent = report.summary;
    $("#suggestion-period").textContent = `适用于 ${report.nextWeekStart} 至 ${shift(report.nextWeekStart, 6)}`;
    $("#detail-suggestions").replaceChildren(...report.suggestions.map(item => {
      const card = el("li", `suggestion-card${item.type === "rest" ? " rest" : ""}`);
      card.append(el("span", "plan-tag" + (item.type === "rest" ? " rest" : ""), types[item.type] || types.other), el("p", "", item.text)); return card;
    }));
    if (!report.suggestions.length) $("#detail-suggestions").append(el("li", "suggestion-card", "这次没有额外建议，按自己的安排继续。"));
    $("#detail-generated").textContent = `生成于 ${generated(report.generatedAt)}（北京时间）`;
  }
  function shift(date, days) { return new Date(Date.parse(date + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10); }
  function render(preferred = selected) {
    const matches = matching();
    selected = matches.some(report => report.id === preferred) ? preferred : matches[0]?.id || null;
    $("#mobile-report-select").value = selected || "";
    try {
      const url = new URL(location.href);
      url.search = "";
      url.hash = selected ? "report=" + encodeURIComponent(selected) : "";
      history.replaceState(null, "", url.href);
    } catch { /* Browsers may restrict history changes in local file previews. */ }
    $("#archive-count").textContent = `${matches.length} 份`;
    $("#archive-list").replaceChildren(...matches.slice(0, limit).map(report => {
      const card = el("button", `archive-card${report.id === selected ? " selected" : ""}`);
      card.type = "button"; card.setAttribute("aria-pressed", String(report.id === selected));
      card.setAttribute("aria-label", `${report.start} 至 ${report.end}`);
      const top = el("span", "archive-card-top"); top.append(el("strong", "", dateRange(report)));
      card.append(top, el("span", "archive-preview", report.summary), el("span", "archive-meta", `${report.recordedDays} 天记录 · ${report.totalMinutes} 分钟`));
      card.addEventListener("click", () => {
        selected = report.id;
        if (matchMedia("(max-width: 760px)").matches) { resetFilters(); setSearchOpen(false); }
        render(selected);
        $("#detail-title").focus({ preventScroll: true });
        if (matchMedia("(max-width: 760px)").matches) $("#review-detail").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }); return card;
    }));
    $("#more-reports").hidden = matches.length <= limit;
    $("#report-empty").hidden = matches.length > 0;
    $("#empty-title").textContent = reports.length ? "还没找到这份回顾" : "每一周，都值得回望";
    $("#empty-description").textContent = reports.length ? "换一个关键词或月份试试，之前保存的回顾都在这里。" : "暂时还没有周报。回顾生成后，会按周保存在这里。";
    $("#clear-review-filters").hidden = !reports.length;
    renderDetail(matches.find(report => report.id === selected));
  }
  function resetFilters() { $("#review-search").value = ""; $("#review-month").value = "all"; limit = 8; }
  function setSearchOpen(open) {
    $("#reviews-layout").classList.toggle("search-open", open);
    $("#toggle-review-search").setAttribute("aria-expanded", String(open));
    $("#toggle-review-search").textContent = open ? "收起" : "检索";
  }
  $("#toggle-review-search").addEventListener("click", () => {
    const open = $("#toggle-review-search").getAttribute("aria-expanded") !== "true";
    setSearchOpen(open);
    if (open) $("#review-search").focus();
    else { resetFilters(); render(); }
  });
  $("#mobile-report-select").addEventListener("change", event => {
    const id = event.target.value; resetFilters(); setSearchOpen(false); render(id);
  });
  ["#review-search", "#review-month"].forEach(selector => $(selector).addEventListener(selector === "#review-search" ? "input" : "change", () => { limit = 8; render(); }));
  $("#clear-review-filters").addEventListener("click", () => { resetFilters(); render(); });
  $("#more-reports").addEventListener("click", () => { limit += 8; render(); });
  window.addEventListener("hashchange", () => { if (!location.hash.startsWith("#report=")) return; limit = Math.max(8, reports.findIndex(report => report.id === requestedId()) + 1); render(requestedId()); });

  function theme(value) { document.documentElement.dataset.theme = value; $("#theme-toggle").textContent = value === "dark" ? "☼" : "☾"; $("#theme-toggle").setAttribute("aria-label", value === "dark" ? "切换到浅色主题" : "切换到深色主题"); document.querySelector('meta[name="theme-color"]').content = value === "dark" ? "#17221e" : "#f5f7f8"; }
  try { theme(localStorage.getItem("study-theme") === "dark" ? "dark" : "light"); } catch { theme("light"); }
  $("#theme-toggle").addEventListener("click", () => { const value = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; theme(value); try { localStorage.setItem("study-theme", value); } catch { /* Theme is usable without storage. */ } });
  function showDate() { const date = new Date(); $("#today-label").dateTime = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); $("#today-label").textContent = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", weekday: "long" }).format(date); }
  if (data?.examDate) $("#sidebar-exam").textContent = `目标日 · ${data.examDate.replaceAll("-", ".")}`;
  showDate(); setInterval(showDate, 60000);
  limit = Math.max(8, reports.findIndex(report => report.id === requestedId()) + 1);
  render(requestedId());
})();
