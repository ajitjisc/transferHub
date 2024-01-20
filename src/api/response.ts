import type { APIGatewayProxyResult } from 'aws-lambda';

const baseHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

export const successResponse = (
  data: unknown,
  requestId: string,
  statusCode = 200
): APIGatewayProxyResult => ({
  statusCode,
  headers: baseHeaders,
  body: JSON.stringify({
    data,
    requestId
  })
});

export const errorResponse = (
  code: string,
  message: string,
  requestId: string,
  statusCode = 500
): APIGatewayProxyResult => ({
  statusCode,
  headers: baseHeaders,
  body: JSON.stringify({
    error: {
      code,
      message
    },
    requestId
  })
});
