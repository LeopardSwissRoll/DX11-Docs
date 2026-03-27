// nav.js — 네비게이션 중앙 관리
// 페이지 추가 시 pages 배열에 항목 추가만 하면 됨. 기존 HTML 수정 불필요.

const NAV_DATA = {
  xp: { level: 7, percent: 95 },

  // flat 배열 = 페이지 순서. pages[i-1]=prev, pages[i+1]=next (선형, 순환 아님)
  pages: [
    { id: "index", file: "index.html", title: "홈", icon: "🏠", group: null },

    // ── Day 01 ──
    {
      id: "0001_01",
      file: "0001_01_Win32_게임프레임워크_초기구조.html",
      title: "프레임워크 초기 구조",
      badge: "day",
      group: "Day 01",
      card: {
        num: "01",
        cardTitle: "Win32 기반 2D 게임 프레임워크 초기 구조",
        desc: "PeekMessage 게임 루프, CRTP 싱글톤 패턴, Object/ObjectPool 시스템 구축. 빈 윈도우 창 위에 게임 엔진의 뼈대를 세우는 첫 수업.",
        tags: ["Win32 API", "PeekMessage", "Singleton", "Object Pool"],
      },
      subLabel: "📋 수업 정리",
    },
    {
      id: "0001_02",
      file: "0001_02_Client.cpp_완전해부.html",
      title: "Client.cpp 해부",
      badge: "detail",
      group: "Day 01",
      subLabel: "🔬 Client.cpp 해부",
    },

    // ── Day 02 ──
    {
      id: "0002_01",
      file: "0002_01_MemoryPool_메모리관리_3가지전략.html",
      title: "메모리 관리 3가지 전략",
      badge: "day",
      group: "Day 02",
      card: {
        num: "02",
        cardTitle: "MemoryPool + 3가지 메모리 관리 전략",
        desc: "MemoryPool/SegmentPool 추가, ObjectPool vs MemoryPool vs shared_ptr 비교. operator new/delete 오버로드, 조건부 컴파일로 전략 전환.",
        tags: ["MemoryPool", "SegmentPool", "operator new", "shared_ptr", "#ifdef"],
      },
      subLabel: "📋 수업 정리",
    },
    {
      id: "0002_02",
      file: "0002_02_operator_new_delete_해부.html",
      title: "operator new/delete",
      badge: "detail",
      group: "Day 02",
      subLabel: "🔬 operator new/delete",
    },
    {
      id: "0002_03",
      file: "0002_03_shared_ptr_스마트포인터_정리.html",
      title: "스마트 포인터",
      badge: "detail",
      group: "Day 02",
      subLabel: "🔬 스마트 포인터",
    },

    // ── Day 03 ──
    {
      id: "0003_01",
      file: "0003_01_폴더구조_리팩토링_Defines_통합API.html",
      title: "폴더 구조 + Defines",
      badge: "day",
      group: "Day 03",
      card: {
        num: "03",
        cardTitle: "폴더 구조 리팩토링 + Defines.h 통합 API",
        desc: "Common/Core/Object 폴더 분리, Ptr&lt;T&gt;/New&lt;T&gt;()/Delete&lt;T&gt;() 통합 API, ObjectPool type_index 전환, Perfect Forwarding.",
        tags: ["Folder Structure", "Defines.h", "type_index", "Perfect Forwarding"],
      },
      subLabel: "📋 수업 정리",
    },
    {
      id: "0003_02",
      file: "0003_02_가변인자_템플릿_Perfect_Forwarding.html",
      title: "Perfect Forwarding",
      badge: "detail",
      group: "Day 03",
      subLabel: "🔬 Perfect Forwarding",
    },
    {
      id: "0003_03",
      file: "0003_03_RTTI_type_index_타입을_키로_쓴다.html",
      title: "RTTI + type_index",
      badge: "detail",
      group: "Day 03",
      subLabel: "🔬 RTTI + type_index",
    },
    {
      id: "0003_04",
      file: "0003_04_VS프로젝트_설정_slnx_vcxproj_해부.html",
      title: "VS 프로젝트 설정",
      badge: "detail",
      group: "Day 03",
      subLabel: "🔬 VS 프로젝트 설정",
    },

    // ── Day 04 ──
    {
      id: "0004_01",
      file: "0004_01_GameEngine_프레임워크_전체개요.html",
      title: "GameEngine 프레임워크",
      badge: "day",
      group: "Day 04",
      card: {
        num: "04",
        cardTitle: "GameEngine 프레임워크 + 매니저 시스템",
        desc: "Client.cpp → GameEngine 이동, Init/Run/Logic/Tick 구조, TimeManager(deltaTime), DirectoryManager(filesystem), Logger(폴드 표현식) + LogManager.",
        tags: ["GameEngine", "TimeManager", "Logger", "filesystem", "optional"],
      },
      subLabel: "📋 수업 정리",
    },
    {
      id: "0004_02",
      file: "0004_02_TimeManager_deltaTime_chrono.html",
      title: "TimeManager + deltaTime",
      badge: "detail",
      group: "Day 04",
      subLabel: "🔬 TimeManager + deltaTime",
    },
    {
      id: "0004_03",
      file: "0004_03_DirectoryManager_filesystem_optional.html",
      title: "DirectoryManager + filesystem",
      badge: "detail",
      group: "Day 04",
      subLabel: "🔬 filesystem + optional",
    },
    {
      id: "0004_04",
      file: "0004_04_Logger_LogManager_폴드표현식_로그파일.html",
      title: "Logger + 폴드 표현식",
      badge: "detail",
      group: "Day 04",
      subLabel: "🔬 Logger + 폴드 표현식",
    },
    {
      id: "0004_05",
      file: "0004_05_아키텍처_다이어그램.html",
      title: "아키텍처 다이어그램",
      badge: "detail",
      group: "Day 04",
      subLabel: "🔬 아키텍처 다이어그램",
    },

    // ── Day 05 ──
    {
      id: "0005_01",
      file: "0005_01_pch_DX11_첫발_ComPtr.html",
      title: "pch.h + DX11 첫 발",
      badge: "day",
      group: "Day 05",
      card: {
        num: "05",
        cardTitle: "DX11 초기화 + pch.h + 렌더링 파이프라인",
        desc: "pch.h(미리 컴파일된 헤더) 도입, Device 클래스(DX11 초기화), 렌더링 파이프라인 개론, ComPtr, 벡터/행렬 수학.",
        tags: ["DX11", "Device", "SwapChain", "pch.h", "ComPtr", "Pipeline"],
      },
      subLabel: "📋 수업 정리",
    },
    {
      id: "0005_02",
      file: "0005_02_Device_DX11_초기화_파이프라인.html",
      title: "Device DX11 초기화",
      badge: "detail",
      group: "Day 05",
      subLabel: "🔬 Device 초기화 해부",
    },
    {
      id: "0005_03",
      file: "0005_03_DX11_렌더링_파이프라인_개론.html",
      title: "렌더링 파이프라인 개론",
      badge: "detail",
      group: "Day 05",
      subLabel: "🔬 렌더링 파이프라인",
    },

    // ── Day 06 ──
    {
      id: "0006_01",
      file: "0006_01_삼각형_하나_그리기_전체흐름.html",
      title: "삼각형 하나 그리기",
      badge: "day",
      group: "Day 06",
      card: {
        num: "06",
        cardTitle: "삼각형 렌더링 + Asset/Shader 시스템",
        desc: "GameEngine::Render() 전체 추적, 정점/인덱스 버퍼, HLSL 셰이더, InputLayout, Asset 관리 계층, MemoryPool UB 수정.",
        tags: ["Triangle", "Mesh", "HLSL", "Shader", "InputLayout", "Asset"],
      },
      subLabel: "📋 전체 흐름",
    },
    {
      id: "0006_02",
      file: "0006_02_정점데이터_CPU에서_GPU까지.html",
      title: "정점 데이터 CPU→GPU",
      badge: "detail",
      group: "Day 06",
      subLabel: "🔬 정점/인덱스 버퍼",
    },
    {
      id: "0006_03",
      file: "0006_03_Shader_HLSL_GPU에게_어떻게_그려.html",
      title: "Shader + HLSL",
      badge: "detail",
      group: "Day 06",
      subLabel: "🔬 Shader + HLSL",
    },
    {
      id: "0006_04",
      file: "0006_04_Asset_관리_계층.html",
      title: "Asset 관리 계층",
      badge: "detail",
      group: "Day 06",
      subLabel: "🔬 Asset 관리 계층",
    },

    // ── Day 07 ──
    {
      id: "0007_01",
      file: "0007_01_3D변환_큰그림_로컬에서_화면까지.html",
      title: "3D 변환 큰 그림",
      badge: "day",
      group: "Day 07",
      card: {
        num: "07",
        cardTitle: "3D 변환 + FMatrix + 상수 버퍼",
        desc: "로컬→월드→뷰→투영 공간 변환, FMatrix(union+align), CBuffer(Map/Unmap), HLSL cbuffer, 원근 투영, WASD 입력.",
        tags: ["Matrix", "CBuffer", "Transform", "Projection", "mul(gWVP)"],
      },
      subLabel: "📋 큰 그림",
    },
    {
      id: "0007_02",
      file: "0007_02_FMatrix_행렬_구현_해부.html",
      title: "FMatrix 행렬 구현",
      badge: "detail",
      group: "Day 07",
      subLabel: "🔬 FMatrix 해부",
    },
    {
      id: "0007_03",
      file: "0007_03_상수버퍼_CPU에서_GPU로_행렬전달.html",
      title: "상수 버퍼 CPU→GPU",
      badge: "detail",
      group: "Day 07",
      subLabel: "🔬 상수 버퍼",
    },
  ],
};

// ──────────────────────────────────────────
// IIFE — DOM 준비 후 즉시 실행
// ──────────────────────────────────────────
(function () {
  var pageId = typeof PAGE_ID !== "undefined" ? PAGE_ID : "index";
  var idx = NAV_DATA.pages.findIndex(function (p) { return p.id === pageId; });

  renderSidebar(idx);

  if (pageId !== "index") {
    renderPageNav(idx);
  }

  if (pageId === "index") {
    renderLessonGrid();
  }

  initSidebarToggle();
  initThemeToggle();

  // ── Sidebar ──
  function renderSidebar(currentIdx) {
    var sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    var html = "";
    var pages = NAV_DATA.pages;

    // Navigation 섹션
    var indexPage = pages[0];
    var indexActive = currentIdx === 0 ? ' class="active"' : "";
    html +=
      '<div class="sidebar-section">' +
      '<div class="sidebar-label">Navigation</div>' +
      '<ul class="sidebar-nav">' +
      '<li><a href="' + indexPage.file + '"' + indexActive + '>' +
      indexPage.icon + ' ' + indexPage.title + '</a></li>' +
      '</ul></div>';

    // Day 그룹별 섹션
    var groups = [];
    var groupMap = {};
    for (var i = 0; i < pages.length; i++) {
      var p = pages[i];
      if (!p.group) continue;
      if (!groupMap[p.group]) {
        groupMap[p.group] = [];
        groups.push(p.group);
      }
      groupMap[p.group].push(p);
    }

    for (var g = 0; g < groups.length; g++) {
      var groupName = groups[g];
      var items = groupMap[groupName];
      html +=
        '<div class="sidebar-section">' +
        '<div class="sidebar-label">' + groupName + '</div>' +
        '<ul class="sidebar-nav">';
      for (var j = 0; j < items.length; j++) {
        var item = items[j];
        var isActive = item.id === pageId ? ' class="active"' : "";
        var badge = item.badge
          ? ' <span class="nav-badge ' + item.badge + '">' +
            (item.badge === "day" ? "DAY" : "DEEP") +
            '</span>'
          : "";
        html +=
          '<li><a href="' + item.file + '"' + isActive + '>' +
          item.title + badge + '</a></li>';
      }
      html += '</ul></div>';
    }

    // "On this page" 섹션
    if (typeof ON_THIS_PAGE !== "undefined" && ON_THIS_PAGE.length > 0) {
      html +=
        '<div class="sidebar-section">' +
        '<div class="sidebar-label">On this page</div>' +
        '<ul class="sidebar-nav">';
      for (var k = 0; k < ON_THIS_PAGE.length; k++) {
        var anchor = ON_THIS_PAGE[k];
        html += '<li><a href="#' + anchor.id + '">' + anchor.label + '</a></li>';
      }
      html += '</ul></div>';
    }

    // XP 바
    var xp = NAV_DATA.xp;
    html +=
      '<div class="xp-bar-container">' +
      '<div class="xp-label">LEARNING PROGRESS \u2014 LV.' + xp.level + '</div>' +
      '<div class="xp-bar"><div class="xp-bar-fill" style="width: ' + xp.percent + '%"></div></div>' +
      '</div>';

    sidebar.innerHTML = html;
  }

  // ── Page Nav (prev/next, 선형) ──
  function renderPageNav(currentIdx) {
    var container = document.getElementById("page-nav");
    if (!container) return;

    var pages = NAV_DATA.pages;
    var hasPrev = currentIdx > 0;
    var hasNext = currentIdx < pages.length - 1;

    if (!hasPrev && !hasNext) return;

    var html = "";

    if (hasPrev) {
      var prev = pages[currentIdx - 1];
      html +=
        '<a href="' + prev.file + '">' +
        '<div class="nav-direction">\u2190 PREV</div>' +
        '<div class="nav-title">' + prev.title + '</div>' +
        '</a>';
    }

    if (hasNext) {
      var next = pages[currentIdx + 1];
      html +=
        '<a href="' + next.file + '" class="nav-next"' +
        (!hasPrev ? ' style="margin-left:auto"' : '') + '>' +
        '<div class="nav-direction">NEXT \u2192</div>' +
        '<div class="nav-title">' + next.title + '</div>' +
        '</a>';
    }

    container.innerHTML = html;
  }

  // ── Lesson Grid (index only) ──
  function renderLessonGrid() {
    var container = document.getElementById("lesson-grid");
    if (!container) return;

    var pages = NAV_DATA.pages;
    var groups = [];
    var groupMap = {};
    for (var i = 0; i < pages.length; i++) {
      var p = pages[i];
      if (!p.group) continue;
      if (!groupMap[p.group]) {
        groupMap[p.group] = [];
        groups.push(p.group);
      }
      groupMap[p.group].push(p);
    }

    var html = "";
    var delay = 1;
    for (var g = 0; g < groups.length; g++) {
      var groupName = groups[g];
      var items = groupMap[groupName];
      var cardOwner = null;
      for (var j = 0; j < items.length; j++) {
        if (items[j].card) { cardOwner = items[j]; break; }
      }
      if (!cardOwner) continue;
      var c = cardOwner.card;

      var tags = "";
      for (var t = 0; t < c.tags.length; t++) {
        tags += '<span class="lesson-tag">' + c.tags[t] + '</span>';
      }

      var subLinks = "";
      for (var s = 0; s < items.length; s++) {
        if (items[s].subLabel) {
          subLinks +=
            '<a href="' + items[s].file + '" class="lesson-sub-link">' +
            items[s].subLabel + '</a>';
        }
      }

      html +=
        '<div class="lesson-card fade-in fade-in-d' + delay + '">' +
        '<div class="lesson-num">' + c.num + '</div>' +
        '<div class="lesson-info">' +
        '<div class="lesson-title">' + c.cardTitle + '</div>' +
        '<div class="lesson-desc">' + c.desc + '</div>' +
        '<div class="lesson-tags">' + tags + '</div>' +
        '<div class="lesson-sub-links">' + subLinks + '</div>' +
        '</div></div>';
      delay++;
    }

    container.innerHTML = html;
  }

  // ── Sidebar Toggle (hamburger) ──
  function initSidebarToggle() {
    var hamburger = document.getElementById("hamburger");
    var sidebar = document.getElementById("sidebar");
    var overlay = document.getElementById("sidebarOverlay");
    if (!hamburger || !sidebar || !overlay) return;

    function toggle() {
      hamburger.classList.toggle("active");
      sidebar.classList.toggle("open");
      overlay.classList.toggle("show");
    }

    hamburger.addEventListener("click", toggle);
    overlay.addEventListener("click", toggle);

    sidebar.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest(".sidebar-nav a") && window.innerWidth <= 900) {
        toggle();
      }
    });
  }

  // ── Theme Toggle ──
  function initThemeToggle() {
    var btn = document.getElementById("themeToggle");
    if (!btn) return;

    if (localStorage.getItem("theme") === "light") {
      document.documentElement.classList.add("light");
    }

    btn.addEventListener("click", function () {
      document.documentElement.classList.toggle("light");
      localStorage.setItem(
        "theme",
        document.documentElement.classList.contains("light") ? "light" : "dark"
      );
    });
  }
})();
