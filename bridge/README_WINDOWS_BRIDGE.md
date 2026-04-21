# Windows 本地 OpenD 桥接说明

本目录用于把 **Windows 本机的富途 OpenD** 实时行情推送到云端的 **Shawn Wang 量化盯盘系统**。由于云端网页不能直接访问你电脑上的 `127.0.0.1:11111`，所以需要通过这个本地桥接程序来完成数据中转。

## 目录文件

| 文件 | 作用 |
| --- | --- |
| `windows_futu_bridge.py` | 主桥接程序，连接本机 OpenD，拉取报价并推送到云端接收地址 |
| `bridge_config.example.json` | 配置样例，填入云端接收地址、桥接令牌和追踪标的后即可使用 |

## 运行前准备

1. 确保 **Futu OpenD 已登录**，并保持运行状态。
2. 在系统设置页复制两项信息：
   - **云端接收地址**
   - **桥接令牌**
3. 把 `bridge_config.example.json` 复制一份并改名为 `bridge_config.json`。
4. 在 `bridge_config.json` 中填入：
   - `cloud_ingest_url`（或兼容旧键名 `ingest_url`）
   - `bridge_token`
   - `tracked_symbols`

## 推荐配置

```json
{
  "cloud_ingest_url": "https://你的系统域名/api/futu-bridge/ingest",
  "bridge_token": "系统设置页中的桥接令牌",
  "opend_host": "127.0.0.1",
  "opend_port": 11111,
  "tracked_symbols": ["REPLACE_WITH_REAL_SYMBOL_1", "REPLACE_WITH_REAL_SYMBOL_2"],
  "publish_interval_seconds": 3,
  "request_timeout_seconds": 10
}
```

## 安装依赖

在 Windows PowerShell 中执行：

```powershell
pip install futu-api requests
```

## 启动方式

在 PowerShell 中进入本目录后执行：

```powershell
python .\windows_futu_bridge.py --config .\bridge_config.json
```

如果 `bridge_config.json` 不在当前目录，请改成完整路径，例如：

```powershell
python .\windows_futu_bridge.py --config C:\futu\bridge_config.json
```

请不要把 `bridge_config.json` 直接写成位置参数；PowerShell 下也必须显式保留 `--config`。

如果连接成功，桥接程序会循环执行以下动作：

1. 连接 `127.0.0.1:11111`
2. 订阅港股报价
3. 拉取 `tracked_symbols` 中填写的真实股票价格、成交量、成交额等字段
4. 推送到云端系统
5. 云端仪表板、观察名單、实时信号和交易建议同步刷新

## 成功后的表现

当桥接程序成功运行后，你会在系统设置页和仪表板中看到：

- 桥接状态从 **未连接** 变成 **已连接**
- 最近心跳时间与最近行情更新时间开始刷新
- 观察名單中的数据状态从 **WAIT** 切换为 **LIVE**
- 实时信号页中的价格、涨跌幅、成交量和交易建议跟随行情变化

## 常见问题

### 1. 提示订阅失败
请确认：
- OpenD 已登录
- 端口是 `11111`
- 当前账户具备港股实时行情权限

### 2. 启动时报“参数缺失”
这通常表示你漏掉了 `--config`，正确写法必须是：

```powershell
python .\windows_futu_bridge.py --config .\bridge_config.json
```

### 3. 启动时报“配置文件不存在”
请确认：
- PowerShell 当前目录就是脚本所在目录，或者
- `--config` 后面使用的是配置文件的绝对路径

### 4. 页面仍显示“未连接”
请依次检查：
- `cloud_ingest_url`（或旧键名 `ingest_url`）是否正确
- `bridge_token` 是否与系统设置页一致
- Windows 防火墙是否拦截了 Python 请求
- 本地网络是否可访问当前网页域名

### 5. 日志提示“云端地址未填写”
这通常说明 `cloud_ingest_url` / `ingest_url` 没有写入，或只复制了域名而没有完整接口地址。

### 6. 日志提示“OpenD 未连接”
说明 Windows 本机的 Futu OpenD 尚未登录，或配置里的 `opend_host` / `opend_port` 与实际监听值不一致。

### 7. 报错 `tracked_symbols 不能为空`
请确认 `tracked_symbols` 是至少包含一个真实股票代码的数组，首轮可以直接使用你当前盯盘的真实代码，例如：

```json
["AAPL", "MSFT"]
```

### 8. 页面显示“异常”
说明桥接程序已上报错误，系统设置页会显示最近错误信息。优先检查：
- OpenD 是否掉线
- 追踪代码格式是否正确
- 网络请求是否超时

## 当前第一批港股标的

当前不再预设任何默认标的。

请把 `tracked_symbols` 改成你当前实际盯盘的真实股票代码；后续你也可以继续把更多港股或美股代码加入 `tracked_symbols`。
