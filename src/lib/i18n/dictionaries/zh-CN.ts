import type { PublicDictionary } from "../dictionary";

const dictionary = {
  meta: {
    siteName: "Red Door",
    siteTitle: "Red Door — 越南下泰村漆器",
    siteDescription:
      "Red Door 在河内近郊的下泰漆艺村手工制作漆器：托盘、盒具、杯垫与装饰摆件，层层髹涂、水磨、手工推光。产品通过 SGS 欧盟标准检测，远销美国与欧洲。",
  },
  common: {
    updatingLabel: "更新中",
    skipToContent: "跳至主要内容",
    learnMore: "了解更多",
    explore: "探索",
    viewAll: "查看全部",
    close: "关闭",
    previous: "上一项",
    next: "下一项",
    openMenu: "打开菜单",
    closeMenu: "关闭菜单",
    language: "语言",
    search: "搜索",
    requestQuote: "申请报价",
    readStory: "阅读故事",
    featured: "精选",
    playVideo: "播放视频",
    updatingNotice: "此栏目的内容正在由工坊完善中。",
  },
  nav: {
    home: "首页",
    about: "关于我们",
    products: "产品",
    collections: "系列",
    process: "漆艺工序",
    news: "资讯",
    contact: "联系我们",
  },
  home: {
    eyebrow: "RED DOOR — 下泰村漆艺",
    title: "生动的表面，",
    titleAccent: "由手工塑造",
    heroDescription:
      "越南漆艺的精髓蕴于每一层涂刷——每件产品都是自然与匠人之手的和谐交融。",
    craftTitle: "层层展开的材料故事",
    craftBody:
      "从第一层底胎到最后一道漆，每一件 Red Door 作品都要经历数十道工序和数周的自然阴干。我们髹涂、水磨、再髹涂——直到漆面呈现出静水般的深邃。",
    historyTitle: "工坊的历程",
    featuredTitle: "精选产品",
    collectionsTitle: "系列",
    processTitle: "漆艺工序",
    newsTitle: "工坊手记",
    contactTitle: "开启交流",
    contactBody:
      "请告诉我们您在寻找什么——现有系列、定制设计或出口订单。Red Door 团队将尽快回复您。",
  },
  pages: {
    aboutTitle: "关于我们",
    aboutIntro:
      "Red Door 的工坊位于河内近郊的下泰漆艺村——漆艺在这里世代相传。我们将传统技法与当代设计相结合，把越南漆器带入世界各地的生活空间。",
    productsTitle: "产品",
    productsIntro:
      "托盘、盒具、杯垫、器皿与装饰摆件——每一件都在下泰工坊手工制作，层层髹涂、水磨、手工推光。",
    collectionsTitle: "系列",
    collectionsIntro:
      "Red Door 每年推出一个新系列——这是工坊在材料、色彩与表面工艺上持续探索的成果。打开每本画册即可浏览全部作品。",
    processTitle: "漆艺工序",
    processIntro:
      "一件完整的漆器要经过数十道工序：制胎、裱布刮灰、髹涂、水磨、推光。每一道工序都急不得。",
    newsTitle: "资讯与故事",
    newsIntro:
      "来自下泰工坊的手记：新系列、国际展会，以及每一片漆面背后的故事。",
    contactTitle: "联系与报价申请",
    contactIntro:
      "欢迎联系 Red Door 索取画册、获取报价或洽谈定制订单。我们与世界各地的零售商、设计师和品牌直接合作。",
    searchTitle: "搜索",
    privacyTitle: "隐私政策",
    termsTitle: "使用条款",
    accessibilityTitle: "无障碍声明",
  },
  about: {
    highlightVillageLabel: "漆艺村",
    highlightVillageValue: "下泰村，河内",
    highlightComplianceLabel: "检测",
    highlightComplianceValue: "SGS — 欧盟标准",
    highlightMarketsLabel: "市场",
    highlightMarketsValue: "美国与欧洲",
    pillarKicker: "核心价值",
    pillarsDescription: "每一件走出 Red Door 工坊的作品都不变的三件事。",
    pillarCraftTitle: "全程手作",
    pillarCraftDescription:
      "每一件作品都由手工完成：层层髹漆、层间水磨，再推光至理想的深度。没有两件完全相同的作品。",
    pillarMaterialTitle: "师法自然",
    pillarMaterialDescription:
      "自然存在于色彩、材质，以及漆面捕捉光线的方式之中。我们追求经久耐用、越用越美的器物。",
    pillarStandardTitle: "国际标准",
    pillarStandardDescription:
      "Red Door 产品由 SGS 依据欧盟化学品与材料安全法规检测，足以进入要求最严格的市场。",
  },
  product: {
    category: "类别",
    collection: "系列",
    material: "材料",
    finish: "表面处理",
    dimensions: "尺寸",
    care: "保养",
    leadTime: "生产周期",
    madeToOrder: "按需制作",
    story: "产品故事",
    specifications: "规格",
    related: "相关产品",
    filters: "筛选",
    sort: "排序",
    sortDefault: "策展顺序",
    sortFeatured: "精选优先",
    sortNameAscending: "名称 A–Z",
    sortNameDescending: "名称 Z–A",
    page: "页",
    zoomImage: "查看原尺寸图片",
    zoomUnavailable: "原尺寸图片待补充",
    video: "产品视频",
    videoUnavailable: "该产品的视频正在制作中。",
    variants: "款式选项",
    variantsUnavailable: "该产品暂无其他款式。",
    process: "制作过程",
    processUnavailable: "该产品的制作笔记正在撰写中。",
    noPrice: "价格请咨询",
  },
  collection: {
    openBook: "打开艺术画册",
    viewProducts: "查看产品",
    download: "下载 PDF",
    downloadDisabled: "该系列的 PDF 即将上线",
  },
  news: {
    published: "发布日期",
    by: "作者",
    related: "相关故事",
    share: "分享这篇故事",
    shareNative: "分享",
    copyLink: "复制链接",
    copySuccess: "链接已复制",
    copyFailed: "无法复制链接",
    shareFacebook: "分享到 Facebook",
    shareLinkedIn: "分享到 LinkedIn",
    shareEmail: "通过电子邮件分享",
  },
  contact: {
    fullName: "姓名",
    company: "公司",
    email: "电子邮箱",
    phone: "电话",
    country: "国家或地区",
    countrySelect: "选择国家或地区",
    countryOther: "其他国家或地区",
    interests: "感兴趣的产品或系列",
    quantity: "预计数量",
    deadline: "期望期限",
    deadlineHelp: "请告知您希望收货的时间，以便工坊安排生产计划。",
    notes: "备注",
    attachment: "可选附件",
    attachmentHelp:
      "接受不超过 10 MB 的 PDF、JPG、PNG 或 WebP 文件；请勿附加敏感个人信息。",
    mapTitle: "地图",
    mapDescription:
      "地图仅在您点击后加载，页面初次打开时不会向第三方发起请求。",
    loadMap: "加载地图",
    mapUnavailable: "地图加载失败。您可以直接在 Google 地图中打开。",
    openInMaps: "在 Google 地图中打开",
    consent: "我同意使用我的信息来回复此次咨询。",
    consentHelp: "您提供的信息仅用于回复此次咨询。",
    submit: "发送咨询",
    formNoticeTitle: "在线表单正在完善中",
    formNotice:
      "在此期间，请直接通过电子邮件或电话联系我们——我们将在一至两个工作日内回复。",
    fax: "传真",
    officeAddress: "办公室",
    factoryAddress: "工坊",
    warehouseAddress: "仓库",
  },
  legal: {
    lastUpdated: "更新：2026 年 8 月",
    privacyIntro:
      "Red Door 尊重访问者的隐私。本政策说明您使用 lacquerware.vn 时我们收集哪些信息，以及我们如何使用这些信息。",
    privacySections: [
      {
        title: "我们收集的信息",
        body: "我们仅收集您在联系我们或申请报价时主动提供的信息：姓名、公司、电子邮箱、电话号码及咨询内容。本网站不使用广告 Cookie 或第三方跟踪器。",
      },
      {
        title: "信息的使用方式",
        body: "您的联系方式仅用于回复咨询和沟通订单。我们不会出于营销目的向第三方出售、出租或共享您的数据。",
      },
      {
        title: "隐私相关咨询",
        body: "如需查看、更正或删除您提供的信息，请发送邮件至 sales@reddoor.vn，我们会尽快处理。",
      },
    ],
    termsIntro:
      "以下条款适用于访问和使用由 RED DOOR Co., Ltd. 运营的 lacquerware.vn。",
    termsSections: [
      {
        title: "知识产权",
        body: "本网站的所有图片、画册、文字和设计均归 RED DOOR Co., Ltd. 所有。未经书面同意，请勿复制或将其用于商业用途。",
      },
      {
        title: "产品信息",
        body: "漆器为手工制作，每件作品的色泽和表面纹理可能与照片略有差异——这是工艺的自然特性，并非瑕疵。规格、价格和交期以正式报价单为准。",
      },
      {
        title: "报价与订单",
        body: "本网站内容仅供介绍，不构成具有约束力的要约。所有订单均通过直接洽谈并以书面订单确认成立。",
      },
    ],
    accessibilityIntro:
      "Red Door 希望每一位访问者都能顺畅地使用本网站，包括使用屏幕阅读器和键盘的用户。",
    accessibilitySections: [
      {
        title: "我们的承诺",
        body: "本网站按照 WCAG 2.1 AA 级指南构建：清晰的标题结构、充足的对比度、键盘导航支持以及图片替代文本。",
      },
      {
        title: "已知限制",
        body: "部分内容（如翻页式画册）对辅助技术的优化尚不完善。我们将在后续更新中持续改进。",
      },
      {
        title: "反馈",
        body: "如您在使用本网站时遇到障碍，请通过 sales@reddoor.vn 告诉我们，我们会尽快修复。",
      },
    ],
  },
  footer: {
    description:
      "Red Door 在河内近郊的下泰村手工制作漆器——每一层漆都经手工髹涂、水磨与推光，走进世界各地的生活空间。",
    navigate: "网站导航",
    legal: "法律信息",
    privacy: "隐私",
    terms: "条款",
    accessibility: "无障碍",
    copyright: "© RED DOOR Co., Ltd. — 河内下泰漆艺村。保留所有权利。",
  },
} satisfies PublicDictionary;

export default dictionary;
