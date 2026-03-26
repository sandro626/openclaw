/**
 * WeCom 类型定义
 */

// 企业微信配置
export interface WeComConfig {
  enabled?: boolean;
  corpId?: string;
  agentId?: number;
  agentSecret?: string;
  token?: string;
  encodingAESKey?: string;
  webhookUrl?: string;
  webhookPath?: string;
  dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
  allowFrom?: string[];
  groupPolicy?: "open" | "disabled" | "allowlist";
  groupAllowFrom?: string[];
  groups?: Record<string, { requireMention?: boolean }>;
  mediaMaxMb?: number;
  textChunkLimit?: number;
  proxy?: string;
  // 多账户支持
  name?: string;
  accounts?: Record<string, WeComConfig>;
  // OSS 存储配置
  oss?: {
    enabled?: boolean;
    accessKeyId?: string;
    accessKeySecret?: string;
    bucket?: string;
    region?: string;
    endpoint?: string;
    publicUrlPrefix?: string;
    uploadPath?: string;
  };
  // 微盘配置
  wedrive?: {
    enabled?: boolean;
    defaultSpaceId?: string;
    uploadPath?: string;
    maxFileSize?: number;
  };
  // 通讯录配置
  contacts?: {
    enabled?: boolean;
    contactsSecret?: string; // 通讯录管理 Secret
  };
  // 智能机器人账户配置
  robots?: Record<string, WeComRobotConfig>;
}

// 解析后的账户配置
export interface ResolvedWeComAccount {
  accountId: string;
  name?: string;
  enabled: boolean;
  config: WeComConfig;
  corpId: string;
  agentId: number;
  agentSecret: string;
  token?: string;
  encodingAESKey?: string;
  webhookUrl?: string;
  webhookPath?: string;
}

// 企业微信消息类型
export type WeComMessageType =
  | "text"
  | "image"
  | "voice"
  | "video"
  | "file"
  | "textcard"
  | "news"
  | "mpnews"
  | "markdown"
  | "location"
  | "link"
  | "event";

// 图片消息额外字段
export interface WeComImageMessage {
  PicUrl?: string; // 图片链接
  MediaId?: string; // 图片媒体ID
}

// 语音消息额外字段
export interface WeComVoiceMessage {
  MediaId?: string; // 语音媒体ID
  Format?: string; // 语音格式 (amr, speex等)
  VoiceText?: string; // 语音识别文本 (需开启语音识别)
}

// 视频消息额外字段
export interface WeComVideoMessage {
  MediaId?: string; // 视频媒体ID
  ThumbMediaId?: string; // 视频缩略图媒体ID
}

// 文件消息额外字段
export interface WeComFileMessage {
  MediaId?: string; // 文件媒体ID
  FileName?: string; // 文件名
  FileSize?: number; // 文件大小
}

// 位置消息额外字段
export interface WeComLocationMessage {
  Location_X?: number; // 纬度
  Location_Y?: number; // 经度
  Scale?: number; // 地图缩放级别
  Label?: string; // 位置信息
  AppType?: number; // 应用类型
}

// 链接消息额外字段
export interface WeComLinkMessage {
  Title?: string; // 标题
  Description?: string; // 描述
  Url?: string; // 链接地址
  PicUrl?: string; // 图片链接
}

// 企业微信推送消息
export interface WeComMessage {
  ToUserName: string;
  FromUserName: string;
  CreateTime: number;
  MsgType: string;
  Content?: string;
  MsgId: string;
  AgentID: number;
  // 群消息
  ChatId?: string;
  // 事件
  Event?: string;
  EventKey?: string;
}

// 企业微信事件
export interface WeComEvent {
  ToUserName: string;
  FromUserName: string;
  CreateTime: number;
  Event: string;
  EventKey?: string;
  AgentID: number;
}

// Webhook 验证请求
export interface WeComVerifyRequest {
  msg_signature: string;
  timestamp: string;
  nonce: string;
  echostr?: string;
}

// 解密后的消息
export interface WeComDecryptedMessage {
  ToUserName: string;
  FromUserName: string;
  CreateTime: number;
  MsgType: string;
  Content?: string;
  MsgId: string;
  AgentID: number;
  ChatId?: string;
  // 图片消息字段
  PicUrl?: string;
  MediaId?: string;
  // 语音消息字段
  Format?: string;
  VoiceText?: string;
  // 视频消息字段
  ThumbMediaId?: string;
  // 文件消息字段
  FileName?: string;
  FileSize?: number;
  // 位置消息字段
  Location_X?: number;
  Location_Y?: number;
  Scale?: number;
  Label?: string;
  // 链接消息字段
  Title?: string;
  Description?: string;
  Url?: string;
  // 事件字段
  Event?: string;
  EventKey?: string;
}

// API 响应
export interface WeComApiResponse<T = unknown> {
  errcode: number;
  errmsg: string;
  [key: string]: T | number | string;
}

// 发送消息参数
export interface WeComSendParams {
  touser?: string;
  toparty?: string;
  totag?: string;
  msgtype: WeComMessageType;
  agentid: number;
  text?: { content: string };
  image?: { media_id: string };
  voice?: { media_id: string };
  video?: { media_id: string; title?: string; description?: string };
  file?: { media_id: string };
  textcard?: {
    title: string;
    description: string;
    url?: string;
    btntxt?: string;
  };
  news?: {
    articles: Array<{
      title: string;
      description: string;
      url: string;
      picurl?: string;
    }>;
  };
  markdown?: { content: string };
  safe?: 0 | 1;
  enable_id_trans?: 0 | 1;
  enable_duplicate_check?: 0 | 1;
  duplicate_check_interval?: number;
}

// 上传媒体响应
export interface WeComMediaUploadResponse {
  errcode: number;
  errmsg: string;
  type: string;
  media_id: string;
  created_at: string;
}

// 获取 Access Token 响应
export interface WeComAccessTokenResponse {
  errcode: number;
  errmsg: string;
  access_token?: string;
  expires_in?: number;
}

// 发送文本卡片参数
export interface WeComTextCardParams {
  touser?: string;
  toparty?: string;
  totag?: string;
  agentid: number;
  title: string;
  description: string;
  url: string;
  btntxt?: string;
}

// 发送图文消息参数
export interface WeComNewsParams {
  touser?: string;
  toparty?: string;
  totag?: string;
  agentid: number;
  articles: Array<{
    title: string;
    description: string;
    url: string;
    picurl?: string;
  }>;
}

// 发送 Markdown 参数
export interface WeComMarkdownParams {
  touser?: string;
  toparty?: string;
  totag?: string;
  agentid: number;
  content: string;
  enable_id_trans?: 0 | 1;
}

// Appchat 发送消息参数 (群聊消息)
export interface WeComAppchatSendParams {
  chatid: string;
  msgtype: WeComMessageType;
  text?: { content: string };
  image?: { media_id: string };
  voice?: { media_id: string };
  video?: { media_id: string; title?: string; description?: string };
  file?: { media_id: string };
  textcard?: {
    title: string;
    description: string;
    url?: string;
    btntxt?: string;
  };
  news?: {
    articles: Array<{
      title: string;
      description: string;
      url: string;
      picurl?: string;
    }>;
  };
  markdown?: { content: string };
  safe?: 0 | 1;
}

// 发送消息结果
export interface WeComSendResult {
  channel: "wecom";
  messageId: string;
  chatId: string;
}

// 发送 Appchat 消息响应
export interface WeComAppchatResponse {
  errcode: number;
  errmsg: string;
  msgid?: string;
}

// ===================== 微盘 (WeDrive) 类型定义 =====================

// 微盘文件信息
export interface WeDriveFileInfo {
  fileid: string;
  fatherid: string;
  file_name: string;
  dir: number; // 1=文件夹, 0=文件
  create_time: number;
  update_time: number;
  size: number;
  sharer?: string;
  share_time?: number;
  download_count?: number;
  spaceid: string;
  auth?: number; // 权限位
  version?: number;
  moduler?: string; // 编辑者
  module_time?: number; // 编辑时间
}

// 文件列表响应
export interface WeDriveFileListResponse {
  file_list: WeDriveFileInfo[];
  total: number;
  next_start?: number;
  has_more: number;
}

// 上传文件响应
export interface WeDriveUploadResponse {
  fileid: string;
}

// 下载文件响应
export interface WeDriveDownloadResponse {
  download_url: string;
  cookie_name?: string;
  cookie_value?: string;
}

// 创建文件夹响应
export interface WeDriveCreateFolderResponse {
  fileid: string;
}

// 移动文件响应
export interface WeDriveMoveResponse {
  file_list: Array<{
    fileid: string;
    file_name: string;
  }>;
}

// 重命名响应
export interface WeDriveRenameResponse {
  file: {
    fileid: string;
    file_name: string;
  };
}

// 删除文件响应
export interface WeDriveDeleteResponse {
  file_list: Array<{
    fileid: string;
    result: number; // 0=成功
  }>;
}

// 权限项
export interface WeDriveAclItem {
  type: number; // 0=指定人员, 1=部门, 2=全公司
  userid?: string;
  departmentid?: number;
  auth: number; // 权限位: 1=可下载, 2=可编辑, 4=可阅读, 8=可创建
}

// 添加权限响应
export interface WeDriveAclAddResponse {
  acl_list: Array<{
    type: number;
    userid?: string;
    departmentid?: number;
    auth: number;
  }>;
}

// 删除权限响应
export interface WeDriveAclDelResponse {
  result: number;
}

// 文件设置参数
export interface WeDriveSettingParams {
  auth?: number;
  auth_successor?: number;
}

// 微盘配置
export interface WeDriveConfig {
  enabled?: boolean;
  defaultSpaceId?: string;
  uploadPath?: string;
  maxFileSize?: number; // 最大文件大小 (字节)
}

// ===================== 通讯录 (Contacts) 类型定义 =====================

// 部门信息
export interface WeComDepartment {
  id: number;
  name: string;
  name_en?: string;
  department_leader?: string[];
  parentid: number;
  order: number;
}

// 部门列表响应
export interface WeComDepartmentListResponse {
  department: WeComDepartment[];
}

// 成员信息
export interface WeComUser {
  userid: string;
  name: string;
  name_en?: string;
  department: number[];
  order?: number[];
  position?: string;
  mobile?: string;
  gender?: string; // 1=男, 2=女
  email?: string;
  biz_mail?: string;
  is_leader_in_dept?: number[];
  direct_leader?: string[];
  avatar?: string;
  thumb_avatar?: string;
  telephone?: string;
  alias?: string;
  status?: number; // 1=已激活, 2=已禁用, 4=未激活, 5=退出企业
  qr_code?: string;
  external_position?: string;
  external_profile?: {
    external_corp_name?: string;
    external_attr?: Array<{
      type: number;
      name: string;
      text?: { value: string };
      web?: { url: string; title: string };
      miniprogram?: { appid: string; pagepath: string; title: string };
    }>;
  };
  address?: string;
  open_userid?: string;
  main_department?: number;
  extattr?: {
    attrs?: Array<{ name: string; value: string }>;
  };
}

// 成员详情响应
export interface WeComUserResponse {
  userid: string;
  name: string;
  department: number[];
  [key: string]: unknown; // 包含 WeComUser 所有字段
}

// 成员列表响应
export interface WeComUserListResponse {
  userlist: WeComUser[];
}

// 搜索成员响应
export interface WeComUserSearchResponse {
  userlist: WeComUser[];
  next_open_userid?: string;
}

// 标签信息
export interface WeComTag {
  tagid: number;
  tagname: string;
}

// 标签列表响应
export interface WeComTagListResponse {
  taglist: WeComTag[];
}

// 标签成员响应
export interface WeComTagGetResponse {
  tagid: number;
  tagname?: string;
  userlist: Array<{
    userid: string;
    name: string;
  }>;
  partylist: number[];
}

// 通讯录配置
export interface WeComContactsConfig {
  enabled?: boolean;
  contactsSecret?: string; // 通讯录管理 Secret (独立于应用 Secret)
}

// ===================== 智能机器人 (Intelligent Robot) 类型定义 =====================
// 文档: https://developer.work.weixin.qq.com/document/path/100719

// 智能机器人配置
export interface WeComRobotConfig {
  enabled?: boolean;
  name?: string;
  robotKey?: string; // 机器人唯一标识 (Bot ID)
  webhookPath?: string; // Webhook 路径
  token?: string; // 回调验证 Token (与应用相同时可省略)
  encodingAESKey?: string; // 消息加密 Key (与应用相同时可省略)
  corpId?: string; // 企业ID (可选，从父配置继承)
  dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
  allowFrom?: string[];
  groupPolicy?: "open" | "disabled" | "allowlist";
  groupAllowFrom?: string[];
  streamEnabled?: boolean; // 是否启用流式输出
}

// 智能机器人消息 - 文本
export interface WeComRobotTextMessage {
  msgtype: "text";
  msgid: string;
  chattype: "single" | "group";
  chatid?: string; // 群聊ID (chattype=group时存在)
  sender: {
    userid: string;
    name?: string;
  };
  text: {
    content: string;
  };
  response_url: string; // 回复URL
  query?: {
    stream?: boolean; // 是否流式输出
  };
}

// 智能机器人消息 - 图片
export interface WeComRobotImageMessage {
  msgtype: "image";
  msgid: string;
  chattype: "single" | "group";
  chatid?: string;
  sender: {
    userid: string;
    name?: string;
  };
  image: {
    pic_url?: string;
    media_id?: string;
  };
  response_url: string;
  query?: {
    stream?: boolean;
  };
}

// 智能机器人消息 - 语音
export interface WeComRobotVoiceMessage {
  msgtype: "voice";
  msgid: string;
  chattype: "single" | "group";
  chatid?: string;
  sender: {
    userid: string;
    name?: string;
  };
  voice: {
    media_id?: string;
    voice_text?: string; // 语音识别文本
  };
  response_url: string;
  query?: {
    stream?: boolean;
  };
}

// 智能机器人消息 - 视频
export interface WeComRobotVideoMessage {
  msgtype: "video";
  msgid: string;
  chattype: "single" | "group";
  chatid?: string;
  sender: {
    userid: string;
    name?: string;
  };
  video: {
    media_id?: string;
    thumb_media_id?: string;
  };
  response_url: string;
  query?: {
    stream?: boolean;
  };
}

// 智能机器人消息 - 文件
export interface WeComRobotFileMessage {
  msgtype: "file";
  msgid: string;
  chattype: "single" | "group";
  chatid?: string;
  sender: {
    userid: string;
    name?: string;
  };
  file: {
    media_id?: string;
    filename?: string;
    filesize?: number;
  };
  response_url: string;
  query?: {
    stream?: boolean;
  };
}

// 智能机器人消息 - 混合
export interface WeComRobotMixedMessage {
  msgtype: "mixed";
  msgid: string;
  chattype: "single" | "group";
  chatid?: string;
  sender: {
    userid: string;
    name?: string;
  };
  mixed: {
    content: string;
  };
  response_url: string;
  query?: {
    stream?: boolean;
  };
}

// 智能机器人消息联合类型
export type WeComRobotMessage =
  | WeComRobotTextMessage
  | WeComRobotImageMessage
  | WeComRobotVoiceMessage
  | WeComRobotVideoMessage
  | WeComRobotFileMessage
  | WeComRobotMixedMessage
  | {
      msgtype: string;
      msgid: string;
      chattype: "single" | "group";
      chatid?: string;
      sender: { userid: string; name?: string };
      response_url: string;
      query?: { stream?: boolean };
      [key: string]: unknown;
    };

// 智能机器人响应 - 文本
export interface WeComRobotTextResponse {
  msgtype: "text";
  text: {
    content: string;
    mentioned_list?: string[]; // @成员列表
    mentioned_mobile_list?: string[]; // @手机号列表
  };
}

// 智能机器人响应 - 图片
export interface WeComRobotImageResponse {
  msgtype: "image";
  image: {
    media_id: string;
  };
}

// 智能机器人响应 - 语音
export interface WeComRobotVoiceResponse {
  msgtype: "voice";
  voice: {
    media_id: string;
  };
}

// 智能机器人响应 - 视频
export interface WeComRobotVideoResponse {
  msgtype: "video";
  video: {
    media_id: string;
    title?: string;
    description?: string;
  };
}

// 智能机器人响应 - 文件
export interface WeComRobotFileResponse {
  msgtype: "file";
  file: {
    media_id: string;
  };
}

// 智能机器人响应 - Markdown
export interface WeComRobotMarkdownResponse {
  msgtype: "markdown";
  markdown: {
    content: string;
  };
}

// 智能机器人响应 - 图文
export interface WeComRobotNewsResponse {
  msgtype: "news";
  news: {
    articles: Array<{
      title: string;
      description?: string;
      url: string;
      picurl?: string;
    }>;
  };
}

// 智能机器人响应 - 模板卡片
export interface WeComRobotTemplateCardResponse {
  msgtype: "template_card";
  template_card: {
    card_type: "text_notice" | "news_notice" | "button_interaction" | "vote_interaction";
    source?: {
      icon_url?: string;
      desc?: string;
      desc_color?: number;
    };
    main_title?: {
      title: string;
      desc?: string;
    };
    emphasis_content?: {
      title?: string;
      desc?: string;
    };
    sub_title_text?: string;
    horizontal_content_list?: Array<{
      keyname: string;
      value: string;
      type?: 0 | 1 | 2; // 0=文本, 1=链接, 2=附件下载
      url?: string;
      media_id?: string;
    }>;
    jump_list?: Array<{
      type: 1 | 2; // 1=跳转URL, 2=跳转小程序
      url?: string;
      appid?: string;
      pagepath?: string;
      title: string;
    }>;
    card_action?: {
      type: 1 | 2;
      url?: string;
      appid?: string;
      pagepath?: string;
    };
    button_selection?: {
      question_key: string;
      title: string;
      option_list: Array<{
        id: string;
        text: string;
      }>;
      selected_id?: string;
    };
    button_list?: Array<{
      text: string;
      style: 1 | 2 | 3; // 1=主要, 2=次要, 3=警告
      key: string;
    }>;
    checkbox?: {
      question_key: string;
      option_list: Array<{
        id: string;
        text: string;
        is_checked?: boolean;
      }>;
      mode?: 0 | 1; // 0=单选, 1=多选
    };
    submit_button?: {
      text: string;
      key: string;
    };
    select_list?: Array<{
      question_key: string;
      title: string;
      selected_id?: string;
      option_list: Array<{
        id: string;
        text: string;
      }>;
    }>;
  };
}

// 智能机器人响应联合类型
export type WeComRobotResponse =
  | WeComRobotTextResponse
  | WeComRobotImageResponse
  | WeComRobotVoiceResponse
  | WeComRobotVideoResponse
  | WeComRobotFileResponse
  | WeComRobotMarkdownResponse
  | WeComRobotNewsResponse
  | WeComRobotTemplateCardResponse;
