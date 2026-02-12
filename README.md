# NetControl — 信令与示例说明

这个仓库包含一个基于 WebSocket 的最小信令服务器（`main.go`），用于在控制端和被控端之间转发 WebRTC 信令消息；同时提供一个浏览器接收端示例和被控端的实现思路。

组件概要
- `main.go`：Go 实现的 WebSocket 信令服务器，监听 `:8081`，路由：
  - `GET /ws?id=<id>&role=<role>` 建立 WebSocket 信令通道
  - `GET /list` 列出当前在线客户端
- `Controler/index.html`：浏览器端（接收端），通过信令答复 offer，并在 DataChannel 中接收 JPEG 帧，渲染到 `<canvas>`。
- `UnderControl/`：被控端 C++ 示例（通过 libdatachannel + OpenCV 采集摄像头并通过 DataChannel 发送 JPEG 帧）。示例代码位于 `UnderControl/main.cpp`（此处为占位和说明）。

设计说明
- 信令格式：JSON 对象，示例：

  {"type":"offer","from":"senderId","to":"receiverId","payload":"SDP 文本"}

  {"type":"answer","from":"receiverId","to":"senderId","payload":"SDP 文本"}

  {"type":"candidate","from":"...","payload":"ICE candidate JSON"}

- 我们使用公共 STUN：`stun:stun.l.google.com:19302`。

Controler（浏览器）使用说明
1. 在项目根目录启动信令服务器：

```bash
go run main.go
```

2. 在浏览器中打开：

```
file:///<path-to-repo>/Controler/index.html
```

3. 填入一个 `id`（例如 `controller1`），点击 “连接信令”。等待来自被控端的 offer 并自动答复。

UnderControl（被控端）实现说明

由于在不同平台上构建 libdatachannel 与 websocket 客户端的方式有所不同，下面给出推荐路线与关键点：

1. 依赖安装（示例，macOS）：

```bash
# 安装 libdatachannel（参见 https://github.com/paullouisageneau/libdatachannel）
# 例如通过 brew / 手动构建
# 安装 OpenCV
brew install opencv
```

2. 被控端逻辑要点：
- 使用 libdatachannel 创建 `PeerConnection`，配置 `iceServers` 指向 `stun:stun.l.google.com:19302`。
- 使用 websocket 客户端（如 `websocketpp` 或 `libwebsockets`）连接信令服务器：`ws://<signaling-host>:8081/ws?id=<id>&role=undercontrol`。
- 创建 DataChannel（例如 label: `frames`），在 `onopen` 捕获摄像头帧：
  - 使用 OpenCV `cv::VideoCapture cap(0);` 读取 `cv::Mat` 帧
  - 使用 `cv::imencode(".jpg", frame, buf)` 压缩为 JPEG 二进制
  - 通过 DataChannel 发送二进制帧（注意不要超过 MTU，必要时分片并在接收端重组）
- 在 libdatachannel 的 `onlocaldescription` 回调中获取 SDP（offer），并通过信令服务器发送给 `controller`。
- 处理来自信令的 `answer` 与 `candidate` 并调用相应 API（`SetRemoteDescription` / `AddIceCandidate`）。

3. 注意事项：
- 直接将大帧发到 DataChannel 可能触发分片/拥塞，建议将图像压缩并做节流（例如 10-15 fps）。
- 如果你需要原生的媒体轨道（audio/video）而不是 DataChannel 传输，请改为使用 libdatachannel 的媒体轨道 API（示例参考 libdatachannel 官方 `examples/camera.cpp`）。

示例运行（高层步骤）
1. 启动 Go 信令服务器：`go run main.go`
2. 启动被控端（C++ 程序），让其连接信令并发送 offer
3. 在浏览器打开 `Controler/index.html`，连接信令并等待 answer，成功后 DataChannel 建立并开始接收帧

如果你希望我：
- 提供一个完整、可编译的 `UnderControl` C++ 实现（包含 websocket 客户端与 libdatachannel 使用示例），我可以继续实现并提供 `CMakeLists.txt` 及依赖安装脚本（注意：这会比示例代码更长）。
- 或我现在把 `UnderControl/main.cpp` 补齐为较完整的实现（尝试用 `libdatachannel` + `websocketpp`），然后我会在本地（仓库环境）运行静态检查。