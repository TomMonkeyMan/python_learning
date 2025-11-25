🔧 一、网络与协议类（用 socket, http.server, urllib 等）

简易 HTTP 服务器
使用 http.server 实现一个能返回 JSON 的 API（如 /time 返回当前时间）
进阶：支持 POST 请求解析 JSON body
TCP 聊天室（单房间）
用 socket + threading 实现多客户端聊天
客户端用 telnet 或自己写一个 CLI 客户端
简易 Ping 工具
用 socket 发送 ICMP Echo Request（需 root 权限）
或退而求其次：用 subprocess 调用系统 ping 并解析结果
URL 解析器
不用 urllib.parse，手动实现 parse_url(url) 函数，返回 scheme/host/path/query 等
⏳ 二、并发与异步类（用 threading, queue, asyncio）

生产者-消费者模型
用 queue.Queue + 多线程，模拟日志生成与处理
线程安全的计数器
用 threading.Lock 实现一个 SafeCounter 类，支持 increment() 和 value
简易协程任务调度器（async/await 入门）
用 asyncio 写两个异步函数（如 fetch_data, process_data），用 await 串行/并行执行
定时任务调度器
每隔 N 秒执行一个函数（用 threading.Timer 或 sched 模块）
🗃️ 三、文件与系统类（用 os, pathlib, json, csv）

目录树打印工具
类似 tree 命令，递归打印目录结构（用 os.walk 或 pathlib）
日志分析器
读取 Nginx/Apache 日志（模拟格式），统计 IP 访问次数（用 collections.Counter）
配置文件加载器
手动解析 .ini 或简单 JSON 配置文件，封装成 Config 类
文件同步工具（简易版 rsync）
比较两个目录，复制新增/修改的文件（用 filecmp + shutil）
🧠 四、数据结构与算法类（纯 Python 实现）

LRU 缓存（不用 functools.lru_cache）
用字典 + 双向链表（或 collections.OrderedDict）实现
命令行版待办事项（Todo CLI）
数据存在 JSON 文件中，支持 add, list, done 命令（用 argparse）
简易表达式计算器
支持 2 + 3 * (4 - 1)，用栈实现（不调用 eval！）
单词频率统计器
读取文本文件，统计词频，输出 Top 10（注意大小写、标点处理）
🧪 五、测试与工程实践类

单元测试练习
给你写的 LRU 缓存或计算器写 unittest 测试用例
上下文管理器实战
实现一个 Timer() 上下文管理器，自动打印代码块执行时间：
Python

编辑



with Timer():
    time.sleep(1)
# 输出: Elapsed: 1.00s
装饰器练习
写一个 @retry(max_attempts=3) 装饰器，自动重试失败函数
🎮 六、趣味小项目（保持兴趣）

猜数字游戏（带历史记录）
保存每轮猜测到文件，下次启动显示历史
简易 Markdown → HTML 转换器
只处理 # 标题 和 - 列表项，用正则或字符串替换
天气 CLI（模拟）
不调 API！本地写一个 get_weather(city) 返回模拟数据，重点练习参数解析和输出格式化
