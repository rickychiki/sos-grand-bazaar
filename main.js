let node, link, tooltip;
let currentLang = "zh-Hant";
let isDragging = false;
let selectedNode = null;
let selectedFilters = {};
let activeSeasons = new Set();
let activeFilters = {};

// === 共用：翻譯函式 ===
function t(id, vars = {}) {
  // 取得對應語系的翻譯
  let text = window.I18N?.[currentLang]?.[id] || id;

  return text;
}

// === 共用：描邊顏色 ===
function getStrokeColor(d) {
  switch (d.type) {
    case "group": return "purple";
    case "processed_goods":
      if (d.windmill === "red") return "red";
      if (d.windmill === "blue") return "blue";
      if (d.windmill === "yellow") return "orange";
      return "gray";
    case "ingredient": return "black";
    default: return "black";
  }
}

// === 共用：描邊顏色 ===
function getFillColor(d) {
  switch (d.type) {
    case "group": return "#c8a2ff";          // 柔和紫
    case "processed_goods":
      if (d.windmill === "red") return "#ff9b9b";    // 淺紅
      if (d.windmill === "blue") return "#9bcfff";   // 淺藍
      if (d.windmill === "yellow") return "#ffe599"; // 淺黃
      return "#cccccc";                              // 淺灰
    case "ingredient": return "#a1d99b";             // 柔和綠
    default: return "#dddddd";                       // 淺灰
  }
}


function renderNodesAndLinks(container, nodesData, linksData) {
  // 清空現有內容
  container.selectAll("line").remove();
  container.selectAll(".node").remove();

  // === 畫連線 ===
  link = container.append("g")
    .selectAll("line")
    .data(linksData)
    .enter().append("line")
    .attr("stroke", "#ccc")
    .attr("stroke-width", 2)
    .attr("opacity", 0.4);

  // === 畫節點 ===
  node = container.append("g")
    .selectAll(".node")
    .data(nodesData)
    .enter().append("g")
    .attr("class", "node")
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended))
    .on("click", handleClick);

  // === 外框 ===
  node.filter(d => d.img && d.type !== "recipe")
    .append("rect")
    .attr("x", -25)
    .attr("y", -25)
    .attr("width", 50)
    .attr("height", 50)
    .attr("rx", 12)
    .attr("ry", 12)
    .attr("fill", "none")
    .attr("stroke", d => getStrokeColor(d))
    .attr("stroke-width", 2);

  // === 插入圖片 ===
  const images = node.append("image")
    .attr("xlink:href", d => d.img)
    .attr("width", 50)
    .attr("height", 50)
    .attr("x", -25)
    .attr("y", -25)
    .attr("clip-path", "url(#rounded)")
    .attr("filter", d => isNodeTrending(d) ? "url(#glow)" : null);

  // === 如果圖片壞掉，就改成圓形 + 文字 ===
  images.each(function (d) {
    this.addEventListener('error', function () {
      const g = d3.select(this.parentNode);
      g.select("image").remove();
      g.select("rect").remove();
      // 🔹 確保 g 繼續綁定 d（避免資料丟失）
      g.datum(d);

      // 加上圓形
      g.append("ellipse")
        .attr("rx", 50) // 水平半徑
        .attr("ry", 20) // 垂直半徑
        .attr("fill", d => getFillColor(d))
        .attr("stroke", isNodeTrending(d) ? "#ff2200ff" : "#666")
        .attr("stroke-width", isNodeTrending(d) ? 4 : 2);


      // 加上支援 i18n 的文字（並用 class 區分）
      g.append("text")
        .attr("class", "node-label")
        .attr("text-anchor", "middle")
        .attr("dy", 4)
        .attr("fill", "#000")
        .text(() => t(d.id)); // 使用目前語言的翻譯
    });
  });


  // === 文字與 tooltip ===
  renderNodeText(node);
  bindTooltip(node);

  return { node, link };
}

function isNodeTrending(d) {
  if (!d.trending) return false;

  const selectedTrending = selectedFilters.trending || new Set();
  const nodeTrendings = Array.isArray(d.trending) ? d.trending : (d.trending ? [d.trending] : []);

  return nodeTrendings.some(tid => selectedTrending.has(tid));
}

function renderNodeText(selection) {
  selection.selectAll(".node-label")
    .text(d => t(d.id));
}

function bindTooltip(selection) {
  tooltip = d3.select(".tooltip");
  selection
    .on("mouseover", (event, d) => {
      let html = "";
      if (isNodeTrending(d)) html += "🔥 "
      const seasonEmoji = {
        spring: "🌸",
        summer: "☀️",
        autumn: "🍁",
        winter: "❄️"
      };;
      html += `${t(d.id)}<br>`;
      html += d.price ? (isNodeTrending(d) ? `⬆️ ${Math.ceil(d.price * 1.3)}G` : `${d.price}G`) : "";
      if (d.base_yield && d.grow_times_in_days) {
        html += `<br><span style="color:#36f">${t(d.crop_type)} (${t("yield")} ${t(d.base_yield)})</span>`;
        html += `<br><span style="color:#36f">${t("growth_days")} ${t(d.grow_times_in_days)}</span>`;
      }
      if (d.craft_time) {
        html += `<br><span style="color:#36f">${d.craft_time / 60} ${t("hours")}</span>`;
      }
      if (d.effect) {
        html += `<br><span style="color:#6a6">${t(d.effect)}</span>`;
      }
      if (d.season && Array.isArray(d.season)) {
        const emojis = d.season.map(s => seasonEmoji[s] || "").join(" ");
        html += `<br><span style="color:#36f">${emojis}</span>`;
      }

      tooltip.html(html)
        .style("opacity", 1)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY + 10) + "px");
    })
    .on("mouseout", () => tooltip.style("opacity", 0));
}

// 合併 nodes
const allNodes = [...ingredients, ...processed_goods, ...groups, ...recipes];

// ===== 自動補上缺的 ingredient node =====
const existing = new Set(allNodes.map(n => n.id));
function ensureNode(id) {
  if (!existing.has(id)) {
    allNodes.push({
      id,
      type: "ingredient",
      img: `./image/${id}.png`
    });
    existing.add(id);
    console.log("🆕 Added missing ingredient:", id);
  }
}
// 檢查 recipes
recipes.forEach(r => {
  r.ingredient.forEach(ing => ensureNode(ing));
});
recipes.forEach(r => {
  r.extra_ingredient.forEach(ing => ensureNode(ing));
});
// 檢查 groups
groups.forEach(g => {
  g.members.forEach(m => ensureNode(m));
});
// 檢查 processed-goods
processed_goods.forEach(g => {
  g.ingredient.forEach(m => ensureNode(m));
});
// console.log("✅ 補齊後 nodes =", allNodes.length);


// ===== 自動生成 link =====
const links = [];

recipes.forEach(r => {
  r.ingredient.forEach(i => {
    const sourceNode = allNodes.find(n => n.id === i);

    // 食譜升級只能單向
    if (sourceNode?.type === "recipe") {
      links.push({
        source: i,       // 舊食譜
        target: r.id,    // 新食譜
        relation: "UPGRADE",
        direction: "up"
      });
    } else {
      // 一般材料雙向
      links.push({ source: i, target: r.id, relation: "AND", direction: "up" });
      links.push({ source: r.id, target: i, relation: "AND", direction: "down" });
    }
  });
});

groups.forEach(r => {
  r.members.forEach(i => {
    links.push({ source: i, target: r.id, relation: "AND", direction: "up" });
    links.push({ source: r.id, target: i, relation: "AND", direction: "down" });
  });
});

processed_goods.forEach(r => {
  r.ingredient.forEach(i => {
    links.push({ source: i, target: r.id, relation: "AND", direction: "up" });
    links.push({ source: r.id, target: i, relation: "AND", direction: "down" });
  });
});

// ===== D3 SVG =====
const svg = d3.select("svg");
const width = window.innerWidth, height = window.innerHeight;
const container = svg.append("g");

// === Zoom / Pan ===
svg.call(
  d3.zoom()
    .scaleExtent([0.3, 3])
    .on("start", () => (isDragging = false))
    .on("zoom", (e) => {
      container.attr("transform", e.transform);
      isDragging = true;
    })
    .on("end", () => setTimeout(() => (isDragging = false), 100))
);

// === 點擊空白區清除選取 ===
svg.on("click", (event) => {
  if (isDragging) return;
  if (event.target.closest(".node")) return;

  selectedNode = null;
  clearHighlight();
});

const simulation = d3.forceSimulation(allNodes)
  .force("link", d3.forceLink(links).id(d => d.id).distance(200))
  .force("charge", d3.forceManyBody().strength(-300))
  .force("center", d3.forceCenter(width / 2, height / 2))
  .force("collision", d3.forceCollide(50))
  .force("x", d3.forceX(width / 2).strength(0.05))
  .force("y", d3.forceY(height / 2).strength(0.05));

// === 先定義箭頭樣式 ===
const defs = svg.append("defs");

// 定義 filter
svg.append("defs")
  .append("filter")
  .attr("id", "glow")
  .append("feDropShadow")
  .attr("dx", 0)
  .attr("dy", 0)
  .attr("stdDeviation", 4)
  .attr("flood-color", "red")
  .attr("flood-opacity", 1);

// 黑色箭頭
defs.append("marker")
  .attr("id", "arrow-black")
  .attr("viewBox", "0 -5 10 10")
  .attr("refX", 45)
  .attr("refY", 0)
  .attr("markerWidth", 6)
  .attr("markerHeight", 6)
  .attr("orient", "auto")
  .append("path")
  .attr("d", "M0,-5L10,0L0,5")
  .attr("fill", "#333");

// 紫色箭頭
defs.append("marker")
  .attr("id", "arrow-purple")
  .attr("viewBox", "0 -5 10 10")
  .attr("refX", 45)
  .attr("refY", 0)
  .attr("markerWidth", 6)
  .attr("markerHeight", 6)
  .attr("orient", "auto")
  .append("path")
  .attr("d", "M0,-5L10,0L0,5")
  .attr("fill", "#a020f0");

// 綠色箭頭
defs.append("marker")
  .attr("id", "arrow-green")
  .attr("viewBox", "0 -5 10 10")
  .attr("refX", 45)
  .attr("refY", 0)
  .attr("markerWidth", 6)
  .attr("markerHeight", 6)
  .attr("orient", "auto")
  .append("path")
  .attr("d", "M0,-5L10,0L0,5")
  .attr("fill", "#00FF00");

// 橙色箭頭
defs.append("marker")
  .attr("id", "arrow-orange")
  .attr("viewBox", "0 -5 10 10")
  .attr("refX", 45)
  .attr("refY", 0)
  .attr("markerWidth", 6)
  .attr("markerHeight", 6)
  .attr("orient", "auto")
  .append("path")
  .attr("d", "M0,-5L10,0L0,5")
  .attr("fill", "#FFA500");

// 紅色箭頭
defs.append("marker")
  .attr("id", "arrow-red")
  .attr("viewBox", "0 -5 10 10")
  .attr("refX", 45)
  .attr("refY", 0)
  .attr("markerWidth", 6)
  .attr("markerHeight", 6)
  .attr("orient", "auto")
  .append("path")
  .attr("d", "M0,-5L10,0L0,5")
  .attr("fill", "#ff0000");

// 藍色箭頭
defs.append("marker")
  .attr("id", "arrow-blue")
  .attr("viewBox", "0 -5 10 10")
  .attr("refX", 45)
  .attr("refY", 0)
  .attr("markerWidth", 6)
  .attr("markerHeight", 6)
  .attr("orient", "auto")
  .append("path")
  .attr("d", "M0,-5L10,0L0,5")
  .attr("fill", "#0000ff");


({ node, link } = renderNodesAndLinks(container, allNodes, links));

simulation.nodes(allNodes);
simulation.force("link").links(links);
simulation.on("tick", () => {
  link
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y);
  node.attr("transform", d => `translate(${d.x},${d.y})`);
});

// ===== drag =====
function dragstarted(event, d) { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
function dragended(event, d) { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }

function handleClick(event, d) {
  if (isDragging) return;

  if (selectedNode && selectedNode.id !== d.id) {
    clearHighlight();
  }

  // 蒐集相關節點
  if (selectedNode && selectedNode.id === d.id && Object.keys(activeFilters).length === 0) {
    addExtraLinks(d); // 只有沒有任何篩選時顯示紅線
    return;
  }

  selectedNode = d;

  const connected = new Set([d.id]);
  const queue = [{ id: d.id, level: 0 }];

  while (queue.length > 0) {
    const { id, level } = queue.shift();

    links.forEach(l => {
      const src = typeof l.source === "object" ? l.source.id : l.source;
      const tgt = typeof l.target === "object" ? l.target.id : l.target;

      // ingredient → 上游 only
      if (d.type === "ingredient" && l.direction === "up" && src === id && !connected.has(tgt)) {
        connected.add(tgt);
        queue.push({ id: tgt, level: level + 1 });
      }

      // // processed-goods → 上游全部，下一層只一次
      if (d.type === "processed_goods" || d.type === "group") {
        if (l.direction === "up" && src === id && !connected.has(tgt)) {
          connected.add(tgt);
          queue.push({ id: tgt, level: level + 1 });
        }
        if (l.source.id === d.id) connected.add(l.target.id);
        if (l.target.id === d.id) connected.add(l.source.id);
      }

      // recipe → 下一層一次 (顯示它需要的材料/群組)
      if (d.type === "recipe") {
        if (l.source.id === d.id) connected.add(l.target.id);
        if (l.target.id === d.id) connected.add(l.source.id);
      }
    });
  }

  // ===== 節點透明度 =====
  node.selectAll("image")
    .attr("opacity", n => connected.has(n.id) ? 1 : 0.1);

  // ===== 調整外框顯示 =====
  node.selectAll("rect")
    .attr("opacity", d => {
      return connected.has(d.id) ? 1 : 0;
    });

  // ===== 調整純文字顯示 =====
  node.selectAll("ellipse")
    .attr("opacity", d => {
      return connected.has(d.id) ? 1 : 0.1;
    });
  node.selectAll("text")
    .attr("opacity", d => {
      return connected.has(d.id) ? 1 : 0.1;
    });

  function getLinkColor(sourceNode, targetNode, connected) {
    if (!connected.has(sourceNode.id) || !connected.has(targetNode.id)) return "#ccc";

    // === 紫線邏輯：Group / Recipe 關聯 ===
    const isPurpleLink =
      (
        ["bread_a", "bread_b", "jam_a"].includes(targetNode?.id) &&
        targetNode?.members?.includes(sourceNode.id)
      ) ||
      (
        targetNode?.type === "group" &&
        targetNode?.members?.includes(sourceNode.id)
      );
    if (isPurpleLink) return "#a020f0";

    // === processed-goods 顏色邏輯 ===
    if (targetNode?.type === "processed_goods" && targetNode?.ingredient?.includes(sourceNode.id)) {
      const colorMap = {
        blue: "#0000FF",
        red: "#FF0000",
        yellow: "#FFA500"
      };
      return colorMap[targetNode.windmill] || "#808080"; // 預設灰
    }

    // === Recipe 顏色邏輯 ===
    if (targetNode?.type === "recipe") {
      if (sourceNode?.type === "recipe") return "#00FF00"; // recipe → recipe 綠線
      if (targetNode?.ingredient?.includes(sourceNode.id)) return "#000000"; // 普通 recipe 黑線
    }

  }

  // ===== 連線樣式 =====
  link
    .attr("stroke", d => getLinkColor(d.source, d.target, connected))
    .attr("marker-end", l => {
      const srcId = typeof l.source === "object" ? l.source.id : l.source;
      const tgtId = typeof l.target === "object" ? l.target.id : l.target;
      const targetNode = allNodes.find(n => n.id === tgtId);
      const sourceNode = allNodes.find(n => n.id === srcId);

      if (connected.has(srcId) && connected.has(tgtId)) {
        // 麵包指向麵包群組
        if ((targetNode?.id === "bread_a" || targetNode?.id === "bread_b") && targetNode.members.includes(sourceNode.id)) return "url(#arrow-purple)";
        // 麵包指向麵包群組
        if ((sourceNode?.id === "bread_a" || sourceNode?.id === "bread_b") && sourceNode.members.includes(targetNode.id)) return null;
        // 果醬指向果醬群組
        if ((targetNode?.id === "jam_a") && targetNode.members.includes(sourceNode.id)) return "url(#arrow-purple)";
        // 果醬指向果醬群組
        if ((sourceNode?.id === "jam_a") && sourceNode.members.includes(targetNode.id)) return null;
        // 紅箭頭食材指向加工品
        if (targetNode?.type === "processed_goods" && targetNode?.ingredient.includes(sourceNode.id) && targetNode?.windmill === "red") return "url(#arrow-red)";
        // 藍箭頭食材指向加工品
        if (targetNode?.type === "processed_goods" && targetNode?.ingredient.includes(sourceNode.id) && targetNode?.windmill === "blue") return "url(#arrow-blue)";
        // 橙箭頭食材指向加工品
        if (targetNode?.type === "processed_goods" && targetNode?.ingredient.includes(sourceNode.id) && targetNode?.windmill === "yellow") return "url(#arrow-orange)";
        // 紫箭頭指向群組
        if (targetNode?.type === "group" && targetNode?.members.includes(sourceNode.id)) return "url(#arrow-purple)";
        // 黑箭頭指向食譜
        if (targetNode?.type === "recipe" && targetNode?.ingredient.includes(sourceNode.id) && sourceNode?.type !== "recipe") return "url(#arrow-black)";
        // 橙箭頭食譜指向食譜
        if (sourceNode?.type === "recipe" && targetNode?.type === "recipe") return "url(#arrow-green)";
      }
      return null;
    })
    .attr("opacity", l => {
      const srcId = typeof l.source === "object" ? l.source.id : l.source;
      const tgtId = typeof l.target === "object" ? l.target.id : l.target;
      return connected.has(srcId) && connected.has(tgtId) ? 1 : 0.1;
    });
  link.filter(l => (l.target.id === "bread_a" || l.target.id === "bread_b" || l.target.id === "jam_a"))
    .raise();
}

function addExtraLinks(d) {
  container.selectAll("line.extra").remove();
  const newLinks = [];

  // 1️⃣ 如果點擊的是 recipe 並且有 extra_ingredient → 原本功能
  if (selectedNode.type === "recipe" &&
    selectedNode.extra_ingredient &&
    Array.isArray(selectedNode.extra_ingredient)) {
    selectedNode.extra_ingredient.forEach(ing => {
      const sourceNode = allNodes.find(n => n.id === ing);
      if (sourceNode) {
        newLinks.push({
          source: sourceNode,
          target: selectedNode,
          relation: "EXTRA",
          direction: "up",
          temp: true
        });
      }
    });
  }

  // 2️⃣ 如果點擊的是 ingredient / processed-goods / group → 找出 recipes 的 extra_ingredient 包含 selectedNode.id
  if (selectedNode.type !== "recipe") {
    allNodes
      .filter(n => n.type === "recipe" &&
        n.extra_ingredient &&
        n.extra_ingredient.includes(selectedNode.id))
      .forEach(r => {
        newLinks.push({
          source: selectedNode,
          target: r,
          relation: "EXTRA",
          direction: "up",
          temp: true
        });
      });
  }

  // 讓 extra 食材也亮起來
  const extraIds = newLinks.map(l => typeof l.source === "object" ? l.source.id : l.source);

  // 加上紅線
  container.append("g")
    .selectAll("line.extra")
    .data(newLinks)
    .enter()
    .append("line")
    .attr("class", "extra")
    .attr("stroke", "red")
    .attr("stroke-dasharray", "5,3")
    .attr("stroke-width", 3)
    .attr("opacity", 1);

  // 如果點擊的是 ingredient，確保被連線到的 recipe 也加入 extraIds
  newLinks.forEach(l => {
    if (typeof l.target === "object") extraIds.push(l.target.id);
  });

  // ===== 調整外框顯示 =====
  node.selectAll("rect")
    .attr("opacity", function (nd) {
      if (extraIds.includes(nd.id) || nd.id === d.id) return 1;
      return d3.select(this).attr("opacity");
    });

  node.select("image")
    .attr("opacity", function (nd) {
      if (extraIds.includes(nd.id) || nd.id === d.id) return 1;
      return d3.select(this).attr("opacity");
    });

  // ===== 調整純文字顯示 =====
  node.selectAll("ellipse")
    .attr("opacity", function (nd) {
      if (extraIds.includes(nd.id) || nd.id === d.id) return 1;
      return d3.select(this).attr("opacity");
    });

  node.select("text")
    .attr("opacity", function (nd) {
      if (extraIds.includes(nd.id) || nd.id === d.id) return 1;
      return d3.select(this).attr("opacity");
    });

  function adjustLine(x1, y1, x2, y2, r) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len === 0) return { x1, y1, x2, y2 };

    const offsetX = dx / len * r;
    const offsetY = dy / len * r;

    return {
      x1: x1 + offsetX,
      y1: y1 + offsetY,
      x2: x2 - offsetX,
      y2: y2 - offsetY
    };
  }

  // 讓力導向重新運行（但不會改原始 links）
  simulation.force("link").links([...links, ...newLinks]);
  simulation.alpha(0.5).restart();

  // 確保 tick 更新位置
  simulation.on("tick", () => {
    link.attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);
    const r = 27;
    container.selectAll("line.extra")
      .attr("x1", d => adjustLine(d.source.x, d.source.y, d.target.x, d.target.y, r).x1)
      .attr("y1", d => adjustLine(d.source.x, d.source.y, d.target.x, d.target.y, r).y1)
      .attr("x2", d => adjustLine(d.source.x, d.source.y, d.target.x, d.target.y, r).x2)
      .attr("y2", d => adjustLine(d.source.x, d.source.y, d.target.x, d.target.y, r).y2);
    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });
}

// ===== 右側設定面板開關 =====
const panel = document.getElementById("settings-panel");
const toggleBtn = panel.querySelector(".panel-toggle");
toggleBtn.addEventListener("click", () => panel.classList.toggle("open"));

function updateNodeVisibilityBySeason(selectedSeason) {
  // 切換選中狀態
  if (activeSeasons.has(selectedSeason)) {
    activeSeasons.delete(selectedSeason);
  } else {
    activeSeasons.add(selectedSeason);
  }

  node.transition()
    .duration(500)
    .style("opacity", d => {
      // 🔹 如果沒有選任何季節，全部顯示
      if (!activeSeasons.size) return 1;

      // 🔹 若 season 是陣列
      if (Array.isArray(d.season)) {
        return d.season.some(s => activeSeasons.has(s)) ? 1 : 0.1;
      }

      // 🔹 若是單一字串
      return activeSeasons.has(d.season) ? 1 : 0.1;
    });

}

// ====== 篩選邏輯 ======
function toggleFilter(activeFilters) {

  // === 最終保留的節點 ===
  let keptNodes;
  let firstFiltered = [],
    filteredIngredients = [],
    relatedGroups = [];
  // 先建立快速查找表
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));
  // 1️⃣ 先篩選第一次 節點
  firstFiltered = allNodes.filter(n => {
    // 只篩選特定類型節點
    if (n.type !== "recipe" && n.type !== "ingredient" && n.type !== "processed_goods") return false;

    for (const key in activeFilters) {
      const nodeValue = n[key];
      const filterValues = activeFilters[key];

      // 節點沒有該欄位就跳過
      if (!nodeValue) return false;

      if (Array.isArray(nodeValue)) {
        // nodeValue 與 filterValues 有交集才保留
        if (!nodeValue.some(v => filterValues.includes(v))) return false;
      } else {
        if (!filterValues.includes(nodeValue)) return false;
      }
    }

    return true;
  });

  // === 遞迴搜尋所有關聯材料 ===
  function collectAllIngredients(node, nodeMap, collected = new Set()) {
    // 已收集過的跳過
    if (collected.has(node.id)) return collected;
    collected.add(node.id);

    // group: 展開 members
    if (node.type === "group" && Array.isArray(node.members)) {
      node.members.forEach(memberId => {
        const memberNode = nodeMap.get(memberId);
        if (memberNode) collectAllIngredients(memberNode, nodeMap, collected);
      });
    }

    // processed-goods: 展開它的原料
    if ((node.type === "processed_goods") && Array.isArray(node.ingredient)) {
      node.ingredient.forEach(ingId => {
        const ingNode = nodeMap.get(ingId);
        if (ingNode) collectAllIngredients(ingNode, nodeMap, collected);
      });
    }

    return collected;
  }

  // === 步驟 1：從被篩選到的 recipe 找出直接需要的材料 ===
  const requiredIngredients = new Set();
  firstFiltered.forEach(r => {
    (r.ingredient || []).forEach(id => requiredIngredients.add(id));
  });

  // === 步驟 2：收集所有相關材料（包括群組、加工品、原料）===
  const allRelatedIngredientIds = new Set();

  requiredIngredients.forEach(id => {
    const node = nodeMap.get(id);
    if (node) collectAllIngredients(node, nodeMap, allRelatedIngredientIds);
  });

  // === 步驟 3：篩選出需要保留的節點 ===
  filteredIngredients = allNodes.filter(n => allRelatedIngredientIds.has(n.id));

  function isAnyFilterActive(filters) {
    return Object.values(filters).some(arr => Array.isArray(arr) && arr.length > 0);
  }


  if (!isAnyFilterActive(activeFilters)) {
    // 沒有任何啟用的篩選 → 顯示全部節點
    keptNodes = allNodes;
  } else {
    // 有篩選 → 顯示符合的食譜 + 其材料鏈
    keptNodes = [...firstFiltered, ...filteredIngredients, ...relatedGroups];
  }


  const keptIds = new Set(keptNodes.map(n => n.id));

  const keptLinks = links.filter(l => {
    const src = typeof l.source === "object" ? l.source.id : l.source;
    const tgt = typeof l.target === "object" ? l.target.id : l.target;
    return keptIds.has(src) && keptIds.has(tgt);
  });



  updateGraph(keptNodes, keptLinks);
}

// ===== 篩選對應設定 =====
const filterNodeTypeMap = {
  category: "recipes",
  trending: "recipes",
  effect: "recipes",
  season: "recipes",
};

// 對於 trending 再細分
const trendingTargetTypeMap = {
  red_crops: "others",
  green_crops: "others",
  yellow_crops: "others",
  white_crops: "others",
  sweet_crops: "others",
  round_crops: "others",
  milk: "others",
  eggs: "others",
  wool: "processed_goods",
  honey: "processed_goods",
  mushrooms: "others",
  herbs: "others",
  wildflowers: "others",
  ore: "others",
  gemstones: "others",
  bouquets: "processed_goods",
  "red-colored_recipess": "recipes",
  "green-colored_recipess": "recipes",
  "yellow-colored_recipess": "recipes",
  "white-colored_recipess": "recipes",
  sweet_desserts: "recipes",
  sweet_drinks: "recipes",
  tea: "recipes",
  pink_things: "recipes",
  refreshing_juice: "recipes",
  autumn_flavors: "recipes",
  warm_recipess_for_winter: "recipes",
  cheese: "processed_goods",
  butter: "processed_goods",
  yogurt: "processed_goods",
  mayonnaise: "processed_goods",
  yarn: "processed_goods",
  "seasoning_&_condiments": "processed_goods",
  oils: "processed_goods",
  pickled_foods: "processed_goods",
  tea_tins: "processed_goods",
  accessories: "processed_goods",
  perfumes: "processed_goods",
  dyes: "processed_goods",
  "butterflies_&_ladybugs": "bugs",
  "tree_bugs_&_fireflies": "bugs",
  "dragonflies_&_grasshoppers": "bugs",
  small_spring_fish: "fishing",
  "medium-large_spring_fish": "fishing",
  small_summer_fish: "fishing",
  "medium-large_summer_fish": "fishing",
  small_autumn_fish: "fishing",
  "medium-large_autumn_fish": "fishing",
  small_winter_fish: "fishing",
  "medium-large_winter_fish": "fishing",
  medals: "others"
};

// ===== 多分類 Filter =====
const categories = ["season", "category", "trending", "effect"];
const filterDiv = d3.select("#filters");

function toggleFilterByValue(cat, value) {
  // 初始化 selectedFilters[cat]
  if (!selectedFilters[cat]) selectedFilters[cat] = new Set();

  // 切換選取狀態
  if (selectedFilters[cat].has(value)) {
    selectedFilters[cat].delete(value);
  } else {
    selectedFilters[cat].add(value);
  }

  // 建立 activeFilters
  activeFilters = {};
  for (const key in selectedFilters) {
    if (selectedFilters[key].size > 0) {
      activeFilters[key] = Array.from(selectedFilters[key]);
    }
  }

  toggleFilter(activeFilters);
}

// === 動態產生按鈕 ===
categories.forEach(cat => {
  // 收集所有該欄位的值
  const values = Array.from(new Set(
    allNodes.flatMap(n => {
      const val = n[cat];
      if (!val) return [];
      return Array.isArray(val) ? val : [val];
    })
  ));

  if (!values.length) return;

  const section = filterDiv.append("div").attr("class", "filter-cat").datum(cat);
  section.append("h3").text(t(cat));

  const btnGroup = section.append("div").attr("class", "filter-btn-group");
  section.append("hr");
  // 🔹 特別處理 trending → 依 targetType 分組顯示
  if (cat === "trending") {
    // 依 targetType 分組
    const grouped = d3.group(values, v => trendingTargetTypeMap[v] || "recipes");

    // 🔹 定義自訂排序順序
    const order = ["recipes", "processed_goods", "others", "fishing"];

    // 🔹 依照自訂順序輸出
    order
      .filter(targetType => grouped.has(targetType)) // 只取實際有資料的類別
      .forEach(targetType => {
        const vals = grouped.get(targetType);

        // 小標題
        btnGroup.append("h4")
          .attr("class", "trending-subtitle")
          .datum(targetType)
          .text(t(targetType));

        // 產生每個 trending 按鈕
        vals.forEach(v => {
          btnGroup.append("button")
            .datum(v)
            .attr("class", "filter-btn")
            .text(t(v))
            .on("click", function () {
              const btn = d3.select(this);
              btn.classed("active", !btn.classed("active"));
              toggleFilterByValue(cat, v);
            });
        });
      });
  } else if (cat === "effect") {
    function toggleFilterByValues(cat, values, targetType) {
      values.forEach(v => {
        toggleFilterByValue(cat, v);
      });
    }
    const simplifiedValues = Array.from(new Set(
      values.map(v => v.replace(/_lv\._\d+$/i, ""))
    ));

    simplifiedValues.forEach(v => {
      const targetType = filterNodeTypeMap[cat] || "recipes";

      // 找出該效果的所有等級
      const effectValues = values.filter(orig => orig.startsWith(v));

      btnGroup.append("button")
        .datum(v)
        .attr("class", "filter-btn")
        .text(t(v))
        .on("click", function () {
          const btn = d3.select(this);
          btn.classed("active", !btn.classed("active"));
          toggleFilterByValues(cat, effectValues, targetType);
        });
    });
  } else if (cat === "season") {
    values.forEach(v => {
      btnGroup.append("button")
        .datum(v)
        .attr("class", "filter-btn")
        .text(t(v))
        .on("click", function () {
          const btn = d3.select(this);
          btn.classed("active", !btn.classed("active"));
          updateNodeVisibilityBySeason(v);
        });
    });
  }
  else {
    // 其他類別不分組
    values.forEach(v => {
      btnGroup.append("button")
        .datum(v)
        .attr("class", "filter-btn")
        .text(t(v))
        .on("click", function () {
          const btn = d3.select(this);
          btn.classed("active", !btn.classed("active"));
          toggleFilterByValue(cat, v);
        });
    });
  }
});

function updateGraph(nodesData, linksData) {
  selectedNode = null;
  ({ node, link } = renderNodesAndLinks(container, nodesData, linksData));
  simulation.nodes(nodesData);
  simulation.force("link").links(linksData);
  simulation.alpha(1).restart();
}

function clearHighlight() {
  // 移除 extra 線
  container.selectAll("line.extra").remove();
  // 還原所有線
  link
    .attr("stroke", "#ccc")
    .attr("opacity", 0.4)
    .attr("marker-end", null);

  // 還原所有節點圖片大小
  node.select("image")
    .attr("opacity", 1)

  node.selectAll("rect")
    .attr("opacity", 1);

  // 還原所有純文字顯示
  node.selectAll("ellipse")
    .attr("opacity", 1)
  node.selectAll("text")
    .attr("opacity", 1)

  simulation.alpha(0.2).restart();
}

// ===== i18n 切換 =====
function updateLanguage(lang) {
  currentLang = lang;
  d3.selectAll("#lang-en, #lang-zh-Hant, #lang-zh-Hans, #lang-jp")
    .classed("active", false);
  d3.select(`#lang-${lang}`).classed("active", true);
  renderNodeText(container.selectAll(".node"));
  bindTooltip(container.selectAll(".node"));
  // 🔹 更新 filter category 標題
  d3.selectAll(".filter-cat").each(function () {
    const section = d3.select(this);
    const cat = section.datum();
    section.select("h3").text(t(cat));
  });
  d3.selectAll(".trending-subtitle").each(function () {
    const subtitle = d3.select(this);
    const targetType = subtitle.datum();
    if (targetType) {
      subtitle.text(t(targetType));
    }
  });

  // 🔹 更新 filter 按鈕文字
  d3.selectAll(".filter-btn-group").each(function () {
    const btnGroup = d3.select(this);
    btnGroup.selectAll("button").each(function (d) {
      const btn = d3.select(this);
      btn.text(t(d));
    });
  });

  d3.select("h4.language")
    .text(t("language"));
}

// 綁定按鈕事件
d3.select("#lang-en").on("click", () => updateLanguage("en"));
d3.select("#lang-zh-Hant").on("click", () => updateLanguage("zh-Hant"));
d3.select("#lang-zh-Hans").on("click", () => updateLanguage("zh-Hans"));
d3.select("#lang-jp").on("click", () => updateLanguage("jp"));

updateLanguage(currentLang);