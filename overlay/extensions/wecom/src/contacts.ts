/**
 * WeCom Contacts (通讯录) API 客户端
 * 企业微信通讯录管理
 * 文档: https://developer.work.weixin.qq.com/document/path/90176
 */

import { WeComApiError } from "./api.js";
import type {
  WeComDepartment,
  WeComUser,
  WeComTag,
  WeComDepartmentListResponse,
  WeComUserListResponse,
  WeComUserResponse,
  WeComTagListResponse,
  WeComTagGetResponse,
  WeComUserSearchResponse,
} from "./types.js";

const CONTACTS_BASE_URL = "https://qyapi.weixin.qq.com/cgi-bin";

/**
 * 通讯录 Secret 缓存
 * 通讯录需要独立的 secret（通讯录管理secret）
 */
let contactsSecret: string | null = null;

/**
 * 设置通讯录 Secret
 */
export function setContactsSecret(secret: string | null): void {
  contactsSecret = secret;
}

/**
 * 获取通讯录 Secret
 */
export function getContactsSecret(): string | null {
  return contactsSecret;
}

/**
 * 通用通讯录 API 请求
 */
async function contactsRequest<T>(
  accessToken: string,
  method: "GET" | "POST",
  path: string,
  params?: Record<string, unknown>,
  fetcher?: typeof fetch,
): Promise<T> {
  let url = `${CONTACTS_BASE_URL}/${path}`;
  const fetchImpl = fetcher || fetch;

  let response: Response;

  if (method === "GET") {
    const searchParams = new URLSearchParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += `&${queryString}`;
    }
    response = await fetchImpl(url);
  } else {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: params ? JSON.stringify(params) : undefined,
    });
  }

  if (!response.ok) {
    throw new WeComApiError(-1, `HTTP ${response.status}`);
  }

  const data = (await response.json()) as { errcode: number; errmsg: string } & T;

  // 部分通讯录接口成功时 errcode 可能为 undefined
  if (data.errcode !== undefined && data.errcode !== 0) {
    throw new WeComApiError(data.errcode, data.errmsg);
  }

  return data;
}

// ===================== 部门管理 =====================

/**
 * 获取部门列表
 * @param accessToken 访问令牌
 * @param id 部门ID，不填则获取全部
 */
export async function getDepartmentList(
  accessToken: string,
  id?: string,
  fetcher?: typeof fetch,
): Promise<WeComDepartmentListResponse> {
  const params: Record<string, unknown> = { access_token: accessToken };
  if (id) {
    params.id = id;
  }
  return contactsRequest<WeComDepartmentListResponse>(
    accessToken,
    "GET",
    `department/list?access_token=${encodeURIComponent(accessToken)}`,
    id ? { id } : undefined,
    fetcher,
  );
}

/**
 * 获取子部门ID列表
 * @param accessToken 访问令牌
 * @param id 父部门ID
 */
export async function getSubDepartmentIds(
  accessToken: string,
  id: string,
  fetcher?: typeof fetch,
): Promise<{ department_id: number[] }> {
  return contactsRequest<{ department_id: number[] }>(
    accessToken,
    "GET",
    `department/simplelist?access_token=${encodeURIComponent(accessToken)}`,
    { id },
    fetcher,
  );
}

// ===================== 成员管理 =====================

/**
 * 获取成员详情
 * @param accessToken 访问令牌
 * @param userId 成员UserID
 */
export async function getUser(
  accessToken: string,
  userId: string,
  fetcher?: typeof fetch,
): Promise<WeComUserResponse> {
  return contactsRequest<WeComUserResponse>(
    accessToken,
    "GET",
    `user/get?access_token=${encodeURIComponent(accessToken)}`,
    { userid: userId },
    fetcher,
  );
}

/**
 * 获取部门成员列表
 * @param accessToken 访问令牌
 * @param departmentId 部门ID
 * @param fetchChild 是否递归获取子部门成员
 */
export async function getDepartmentUserList(
  accessToken: string,
  departmentId: number,
  fetchChild: boolean = false,
  fetcher?: typeof fetch,
): Promise<WeComUserListResponse> {
  return contactsRequest<WeComUserListResponse>(
    accessToken,
    "GET",
    `user/list?access_token=${encodeURIComponent(accessToken)}`,
    { department_id: departmentId, fetch_child: fetchChild ? 1 : 0 },
    fetcher,
  );
}

/**
 * 获取部门成员简要信息
 * @param accessToken 访问令牌
 * @param departmentId 部门ID
 * @param fetchChild 是否递归获取子部门成员
 */
export async function getDepartmentSimpleUserList(
  accessToken: string,
  departmentId: number,
  fetchChild: boolean = false,
  fetcher?: typeof fetch,
): Promise<{ userlist: Array<{ userid: string; name: string; department: number[] }> }> {
  return contactsRequest<{
    userlist: Array<{ userid: string; name: string; department: number[] }>;
  }>(
    accessToken,
    "GET",
    `user/simplelist?access_token=${encodeURIComponent(accessToken)}`,
    { department_id: departmentId, fetch_child: fetchChild ? 1 : 0 },
    fetcher,
  );
}

/**
 * 搜索成员
 * @param accessToken 访问令牌
 * @param params 搜索参数
 */
export async function searchUser(
  accessToken: string,
  params: {
    userid?: string;
    name?: string;
    department?: number[];
    status?: number[];
  },
  fetcher?: typeof fetch,
): Promise<WeComUserSearchResponse> {
  const body: Record<string, unknown> = {};
  if (params.userid) body.userid = params.userid;
  if (params.name) body.name = params.name;
  if (params.department) body.department = params.department;
  if (params.status) body.status = params.status;

  return contactsRequest<WeComUserSearchResponse>(
    accessToken,
    "POST",
    `user/search?access_token=${encodeURIComponent(accessToken)}`,
    body,
    fetcher,
  );
}

/**
 * 通过手机号/邮箱获取 UserID
 * @param accessToken 访问令牌
 * @param params 查询参数
 */
export async function getUserIdByPhone(
  accessToken: string,
  params: {
    mobile?: string;
    email?: string;
  },
  fetcher?: typeof fetch,
): Promise<{ userid: string }> {
  const body: Record<string, unknown> = {};
  if (params.mobile) body.mobile = params.mobile;
  if (params.email) body.email = params.email;

  return contactsRequest<{ userid: string }>(
    accessToken,
    "POST",
    `user/getuserid?access_token=${encodeURIComponent(accessToken)}`,
    body,
    fetcher,
  );
}

// ===================== 标签管理 =====================

/**
 * 获取标签列表
 * @param accessToken 访问令牌
 */
export async function getTagList(
  accessToken: string,
  fetcher?: typeof fetch,
): Promise<WeComTagListResponse> {
  return contactsRequest<WeComTagListResponse>(
    accessToken,
    "GET",
    `tag/list?access_token=${encodeURIComponent(accessToken)}`,
    undefined,
    fetcher,
  );
}

/**
 * 获取标签成员
 * @param accessToken 访问令牌
 * @param tagId 标签ID
 */
export async function getTagMembers(
  accessToken: string,
  tagId: number,
  fetcher?: typeof fetch,
): Promise<WeComTagGetResponse> {
  return contactsRequest<WeComTagGetResponse>(
    accessToken,
    "GET",
    `tag/get?access_token=${encodeURIComponent(accessToken)}`,
    { tagid: tagId },
    fetcher,
  );
}

// ===================== 辅助函数 =====================

/**
 * 根据用户名模糊搜索成员
 * @param accessToken 访问令牌
 * @param name 用户名（支持模糊匹配）
 */
export async function findUserByName(
  accessToken: string,
  name: string,
  fetcher?: typeof fetch,
): Promise<WeComUser[]> {
  const result = await searchUser(accessToken, { name }, fetcher);
  return result.userlist || [];
}

/**
 * 根据部门名称查找部门
 * @param accessToken 访问令牌
 * @param name 部门名称
 */
export async function findDepartmentByName(
  accessToken: string,
  name: string,
  fetcher?: typeof fetch,
): Promise<WeComDepartment[]> {
  const result = await getDepartmentList(accessToken, undefined, fetcher);
  const departments = result.department || [];
  return departments.filter((dept) => dept.name.includes(name) || name.includes(dept.name));
}

/**
 * 获取所有成员列表（遍历所有部门）
 * @param accessToken 访问令牌
 */
export async function getAllUsers(
  accessToken: string,
  fetcher?: typeof fetch,
): Promise<WeComUser[]> {
  // 获取所有部门
  const deptResult = await getDepartmentList(accessToken, undefined, fetcher);
  const departments = deptResult.department || [];

  // 获取根部门成员（递归）
  const rootDept = departments.find((d) => d.parentid === 0);
  if (!rootDept) {
    return [];
  }

  const userResult = await getDepartmentUserList(
    accessToken,
    rootDept.id,
    true, // 递归获取
    fetcher,
  );

  return userResult.userlist || [];
}

/**
 * 格式化 @成员 列表为企微消息格式
 * @param users 用户列表
 */
export function formatMentionList(users: WeComUser[]): string {
  return users.map((u) => `<@${u.userid}>`).join("");
}

/**
 * 解析消息中的 @成员
 * @param content 消息内容
 * @returns 被@的用户ID列表
 */
export function parseMentions(content: string): string[] {
  const regex = /<@([a-zA-Z0-9_\-]+)>/g;
  const mentions: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    mentions.push(match[1]);
  }
  return mentions;
}
