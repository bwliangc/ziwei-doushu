# 本机部署与AI功能

正式站点 https://zwds.bwliangc.com；部署路径 /root/apps/ziwei-doushu。
独立Compose，仅发布172.17.0.1:13080到web:3000，CF配置由用户管理。

排盘后，在右侧“AI设置”填写自己的ChatAPI API Key，点击“获取可用模型”，选择模型；可先“连接测试”（产生少量模型用量），再点“命格”等话题或输入问题。起盘时已有有效格式 Key 和模型则自动命格解读一次；未配置时不调用，配置后点击“开始解读”。宫位/四化点击同样属于主动AI解读。

API地址固定https://chatapi.bwliangc.com/v1。浏览器通过同源/api/ai/models、/api/ai/test和/api/interpret代理，不接收任意upstream URL。用户Key仅放Authorization请求头；本站不保存至数据库、环境变量或日志。默认sessionStorage仅当前标签页会话；主动勾选才保存在localStorage，可随时清除；浏览器存储不是加密保险库，请勿在共用设备长期保存。AI内容及命盘不接入遥测。调用消耗用户Key额度。

命盘发送时剔除birthInfo.name；其余命盘结构及问题在用户操作、或已配置起盘时经授权自动首次解读后发送至ChatAPI。连接测试仅发送固定短句，无命盘。AI解读为传统文化学习，不提供医疗诊断或确定财务预测。

构建执行typecheck、原10项回归、scripts/integration/ai.test.ts mock集成、next build。mock覆盖模型列表、用户鉴权、实际completion结构、中文/UTF8/跨块SSE、401/500/网络失败、流错误/截断、输入及跨站Origin；不等于有真实有效Key的端到端验收。没有授权测试Key时不得调用管理员Key。

更新前给运行镜像打备份tag并备份源码/Compose。docker compose build通过后，docker compose up -d --no-deps --wait --wait-timeout 90 web。验证health、页面、canonical/sitemap、/api无Key401和无效Key401/403、公开JS内容。不要更新其他项目或CF。

## 合盘AI

/heming复用同一个AiSettings与当前标签页的Key/模型配置。填写双方信息后由用户点击开始或追问才请求/api/heming；双方姓名剔除，设置提示确认双方同意。每次分析从最新表单重新起盘，避免修改生日后复用旧盘。支持流式、取消及中文错误。双盘验证包含合法日期/时辰/性别、12个唯一地支宫位与星曜结构。新增heming.test.ts覆盖双盘上下文、姓名剔除、非法输入、SSE跨字节、401/500与取消。

## 维度缓存与Markdown

/chart起盘前可配置AI。起盘时配置快照决定是否自动命格一次，后续输入配置不触发自动推理；明确开始按钮可手动启动。每个话题、宫位、四化独立面板及追问上下文，在当前页面内存按稳定命盘身份、模型和不含Key的凭据代次隔离缓存。完整结果切换读取不重发；变盘/换Key/清配置清理或失效旧内容，模型隔离，可重新解读。每个异步请求绑定作用域/维度/请求号，迟到响应不能串写，取消与错误的部分结果不进入完整历史。

命盘与合盘共用react-markdown + remark-gfm，支持GFM表格、标题、列表、加粗和代码块；禁原始HTML，不加载模型图片，拒绝javascript/data等危险链接。新增dimensions.test.ts行为测试及markdown.test.tsx安全/SSR按钮测试。

## 去重和标签页结果缓存

相同实际命盘（排除出生姓名）、维度和模型的成功结果优先复用。跨组件挂载共享内存session，实现进行中single-flight，StrictMode清理不自动取消/重启推理。失败/取消状态阻止切换或重渲染自动重试，只允许明确重试；相同追问防双击及已成功问题重复提交。只有“重新解读（消耗用量）”明确覆盖成功结果。

sessionStorage的ziwei-ai-results-v1保存本机当前标签页的结果和必要上下文/失败标记，最多8盘、JSON字符容量150万，超过容量淘汰旧记录；不包含API Key。页面来回/刷新可复用完整结果，未完成流在刷新后只保留未完成标记并需显式重试；存储不可用则退回内存。换Key或清除配置同步清除缓存。清除配置按钮在起盘表单和合盘设置也生效。关闭标签页后不保证保留。

## 默认折叠设置与本机命盘记录

AiSettings在起盘前、命盘解读和合盘均使用原生details/summary默认折叠，摘要仅显示配置状态和模型，不显示Key。未配置不会强制展开或发送请求。

/chart起盘成功保存ziwei-chart-history-v1至localStorage：schema version=1、birth-form-v1规则、白名单原始出生表单（可选姓名、日期、钟表时间、时辰未知、性别、省市、经度）和保存时间，最多50条。同出生参数/选项忽略姓名去重并置顶，不包含API Key。使用与BirthForm实际提交共用的birthInfoFromForm还原命盘，保留原有起盘规则；不改变子时等既有算法行为。记录可查看、恢复、单删、确认清空；恢复同步保留可编辑原表单，明确不自动调用AI，同身份优先已有会话解读缓存，无缓存显示开始按钮。新起盘已配置自动一次行为保留。

记录只保存在此浏览器，不云同步，不写服务器日志/遥测。读取在客户端effect进行；非法日期/输入/版本/损坏行忽略或给出提示。禁用存储/超配额时保留页面内记录且不阻断起盘。新增history.test.ts持久恢复/23时及经度规则一致性/去重/数量/删除/损坏/配额/恢复零自动调用测试，以及settings.test.tsx默认折叠与SSR不调用测试。真实浏览器点击/刷新仍需单独实测。
