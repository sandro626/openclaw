/**
 * WeCom WeDrive (微盘) API 客户端
 * 企业微信微盘文件管理
 * 文档: https://developer.work.weixin.qq.com/document/path/93656
 */

import { WeComApiError } from "./api.js";
import type {
  WeDriveFileInfo,
  WeDriveFileListResponse,
  WeDriveUploadResponse,
  WeDriveDownloadResponse,
  WeDriveCreateFolderResponse,
  WeDriveMoveResponse,
  WeDriveRenameResponse,
  WeDriveDeleteResponse,
  WeDriveAclAddResponse,
  WeDriveAclDelResponse,
  WeDriveSettingParams,
  WeDriveAclItem,
} from "./types.js";

const WEDRIVE_BASE_URL = "https://qyapi.weixin.qq.com/cgi-bin/wedrive";

/**
 * 通用微盘 API 请求
 */
async function wedriveRequest<T>(
  accessToken: string,
  action: string,
  params: Record<string, unknown>,
  fetcher?: typeof fetch,
): Promise<T> {
  const url = `${WEDRIVE_BASE_URL}/${action}?access_token=${encodeURIComponent(accessToken)}`;

  const fetchImpl = fetcher || fetch;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new WeComApiError(-1, `HTTP ${response.status}`);
  }

  const data = (await response.json()) as { errcode: number; errmsg: string } & T;

  if (data.errcode !== 0) {
    throw new WeComApiError(data.errcode, data.errmsg);
  }

  return data;
}

/**
 * 获取文件列表
 * @param accessToken 访问令牌
 * @param userId 用户ID
 * @param spaceId 空间ID (空间根目录时填空字符串)
 * @param fatherId 父目录ID (根目录时填空字符串)
 * @param sortType 排序方式: 1=名字升序, 2=名字降序, 3=时间升序, 4=时间降序
 * @param start 分页起始位置
 * @param limit 分页大小 (默认100, 最大1000)
 */
export async function getFileList(
  accessToken: string,
  params: {
    userId: string;
    spaceId: string;
    fatherId?: string;
    sortType?: 1 | 2 | 3 | 4;
    start?: number;
    limit?: number;
  },
  fetcher?: typeof fetch,
): Promise<WeDriveFileListResponse> {
  return wedriveRequest<WeDriveFileListResponse>(
    accessToken,
    "file_list",
    {
      userid: params.userId,
      spaceid: params.spaceId,
      fatherid: params.fatherId || "",
      sort_type: params.sortType || 1,
      start: params.start || 0,
      limit: params.limit || 100,
    },
    fetcher,
  );
}

/**
 * 上传文件
 * @param accessToken 访问令牌
 * @param userId 用户ID
 * @param spaceId 空间ID
 * @param fatherId 父目录ID
 * @param fileName 文件名
 * @param fileContent 文件内容 (Base64编码)
 */
export async function uploadFile(
  accessToken: string,
  params: {
    userId: string;
    spaceId: string;
    fatherId: string;
    fileName: string;
    fileContent: string; // Base64
  },
  fetcher?: typeof fetch,
): Promise<WeDriveUploadResponse> {
  return wedriveRequest<WeDriveUploadResponse>(
    accessToken,
    "file_upload",
    {
      userid: params.userId,
      spaceid: params.spaceId,
      fatherid: params.fatherId,
      file_name: params.fileName,
      file_base64_content: params.fileContent,
    },
    fetcher,
  );
}

/**
 * 下载文件
 * @param accessToken 访问令牌
 * @param userId 用户ID
 * @param fileId 文件ID
 */
export async function downloadFile(
  accessToken: string,
  params: {
    userId: string;
    fileId: string;
  },
  fetcher?: typeof fetch,
): Promise<WeDriveDownloadResponse> {
  return wedriveRequest<WeDriveDownloadResponse>(
    accessToken,
    "file_download",
    {
      userid: params.userId,
      fileid: params.fileId,
    },
    fetcher,
  );
}

/**
 * 创建文件夹
 * @param accessToken 访问令牌
 * @param userId 用户ID
 * @param spaceId 空间ID
 * @param fatherId 父目录ID
 * @param folderName 文件夹名称
 */
export async function createFolder(
  accessToken: string,
  params: {
    userId: string;
    spaceId: string;
    fatherId: string;
    folderName: string;
  },
  fetcher?: typeof fetch,
): Promise<WeDriveCreateFolderResponse> {
  return wedriveRequest<WeDriveCreateFolderResponse>(
    accessToken,
    "file_create",
    {
      userid: params.userId,
      spaceid: params.spaceId,
      fatherid: params.fatherId,
      file_name: params.folderName,
      dir: 1, // 1表示文件夹
    },
    fetcher,
  );
}

/**
 * 重命名文件/文件夹
 * @param accessToken 访问令牌
 * @param userId 用户ID
 * @param fileId 文件ID
 * @param newName 新名称
 */
export async function renameFile(
  accessToken: string,
  params: {
    userId: string;
    fileId: string;
    newName: string;
  },
  fetcher?: typeof fetch,
): Promise<WeDriveRenameResponse> {
  return wedriveRequest<WeDriveRenameResponse>(
    accessToken,
    "file_rename",
    {
      userid: params.userId,
      fileid: params.fileId,
      new_name: params.newName,
    },
    fetcher,
  );
}

/**
 * 移动文件/文件夹
 * @param accessToken 访问令牌
 * @param userId 用户ID
 * @param fatherId 目标父目录ID
 * @param replace 是否覆盖同名文件
 * @param fileIds 要移动的文件ID列表
 */
export async function moveFiles(
  accessToken: string,
  params: {
    userId: string;
    fatherId: string;
    replace?: boolean;
    fileIds: string[];
  },
  fetcher?: typeof fetch,
): Promise<WeDriveMoveResponse> {
  return wedriveRequest<WeDriveMoveResponse>(
    accessToken,
    "file_move",
    {
      userid: params.userId,
      fatherid: params.fatherId,
      replace: params.replace ? 1 : 0,
      fileid: params.fileIds,
    },
    fetcher,
  );
}

/**
 * 删除文件/文件夹
 * @param accessToken 访问令牌
 * @param userId 用户ID
 * @param fileIds 要删除的文件ID列表
 */
export async function deleteFiles(
  accessToken: string,
  params: {
    userId: string;
    fileIds: string[];
  },
  fetcher?: typeof fetch,
): Promise<WeDriveDeleteResponse> {
  return wedriveRequest<WeDriveDeleteResponse>(
    accessToken,
    "file_delete",
    {
      userid: params.userId,
      fileid: params.fileIds,
    },
    fetcher,
  );
}

/**
 * 获取文件信息
 * @param accessToken 访问令牌
 * @param userId 用户ID
 * @param fileId 文件ID
 */
export async function getFileInfo(
  accessToken: string,
  params: {
    userId: string;
    fileId: string;
  },
  fetcher?: typeof fetch,
): Promise<{ file_info: WeDriveFileInfo }> {
  return wedriveRequest<{ file_info: WeDriveFileInfo }>(
    accessToken,
    "file_info",
    {
      userid: params.userId,
      fileid: params.fileId,
    },
    fetcher,
  );
}

/**
 * 设置文件权限
 * @param accessToken 访问令牌
 * @param userId 用户ID
 * @param fileId 文件ID
 * @param auth 权限: 1=可下载, 2=可编辑, 4=可阅读(文档), 8=可创建(目录)
 * @param authSuccessor 继承权限
 */
export async function setFileAuth(
  accessToken: string,
  params: {
    userId: string;
    fileId: string;
    auth?: number;
    authSuccessor?: number;
  },
  fetcher?: typeof fetch,
): Promise<{ errcode: number; errmsg: string }> {
  const body: Record<string, unknown> = {
    userid: params.userId,
    fileid: params.fileId,
  };
  if (params.auth !== undefined) {
    body.auth = params.auth;
  }
  if (params.authSuccessor !== undefined) {
    body.auth_successor = params.authSuccessor;
  }
  return wedriveRequest<{ errcode: number; errmsg: string }>(
    accessToken,
    "file_setting",
    body,
    fetcher,
  );
}

/**
 * 添加文件权限
 * @param accessToken 访问令牌
 * @param userId 用户ID
 * @param fileId 文件ID
 * @param aclList 权限列表
 */
export async function addFileAcl(
  accessToken: string,
  params: {
    userId: string;
    fileId: string;
    aclList: WeDriveAclItem[];
  },
  fetcher?: typeof fetch,
): Promise<WeDriveAclAddResponse> {
  return wedriveRequest<WeDriveAclAddResponse>(
    accessToken,
    "acl_add",
    {
      userid: params.userId,
      fileid: params.fileId,
      auth_info: params.aclList,
    },
    fetcher,
  );
}

/**
 * 删除文件权限
 * @param accessToken 访问令牌
 * @param userId 用户ID
 * @param fileId 文件ID
 * @param authInfo 要删除的权限用户ID列表
 */
export async function delFileAcl(
  accessToken: string,
  params: {
    userId: string;
    fileId: string;
    authInfo: Array<{ userid?: string; departmentid?: number }>;
  },
  fetcher?: typeof fetch,
): Promise<WeDriveAclDelResponse> {
  return wedriveRequest<WeDriveAclDelResponse>(
    accessToken,
    "acl_del",
    {
      userid: params.userId,
      fileid: params.fileId,
      auth_info: params.authInfo,
    },
    fetcher,
  );
}

/**
 * 获取空间列表
 * @param accessToken 访问令牌
 * @param userId 用户ID
 */
export async function getSpaceList(
  accessToken: string,
  params: {
    userId: string;
  },
  fetcher?: typeof fetch,
): Promise<{
  space_list: Array<{
    spaceid: string;
    spacename: string;
    auth: number;
    iscreator: number;
  }>;
}> {
  return wedriveRequest<{
    space_list: Array<{
      spaceid: string;
      spacename: string;
      auth: number;
      iscreator: number;
    }>;
  }>(
    accessToken,
    "space_list",
    {
      userid: params.userId,
    },
    fetcher,
  );
}

/**
 * 分享文件 - 创建分享链接
 * @param accessToken 访问令牌
 * @param userId 用户ID
 * @param fileId 文件ID
 */
export async function shareFile(
  accessToken: string,
  params: {
    userId: string;
    fileId: string;
  },
  fetcher?: typeof fetch,
): Promise<{
  share_url: string;
}> {
  return wedriveRequest<{
    share_url: string;
  }>(
    accessToken,
    "file_share",
    {
      userid: params.userId,
      fileid: params.fileId,
    },
    fetcher,
  );
}

// 导出权限常量
export const WEDRIVE_AUTH = {
  /** 可下载 */
  DOWNLOAD: 1,
  /** 可编辑 */
  EDIT: 2,
  /** 可阅读(文档) */
  READ: 4,
  /** 可创建(目录) */
  CREATE: 8,
} as const;
