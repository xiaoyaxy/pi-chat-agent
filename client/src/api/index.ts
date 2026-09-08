import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

import type { ChatRequest, ChatResponse } from '@shared/api.interface';

async function createChatCompletion(request: ChatRequest): Promise<ChatResponse> {
  try {
    const response = await axiosForBackend<ChatResponse>({
      url: '/api/chat/completions',
      method: 'POST',
      data: request,
    });

    return response.data;
  } catch (error: unknown) {
    logger.error('模型调用失败', error);
    throw error;
  }
}

export { createChatCompletion };

// Add more API functions here, use axios instance (`axiosForBackend`) to make requests.
// 
// 使用示例：
// export async function getUserData(userId: string) {
//   try {
//     const response = await axiosForBackend({
//       url: `/api/users/${userId}`,
//       method: 'GET'
//     });
//     return response.data;
//   } catch (error) {
//     logger.error('获取用户数据失败', error);
//     throw error;
//   }
// }
