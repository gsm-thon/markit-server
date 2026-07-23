export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Maskit API",
    version: "0.2.0",
    description: "문서에서 개인정보/블라인드 채용 위반 표현을 탐지하고 마스킹된 안전 사본을 생성하는 API",
  },
  paths: {
    "/health": {
      get: {
        summary: "헬스체크",
        responses: {
          "200": {
            description: "서버 정상",
            content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", example: "ok" } } } } },
          },
        },
      },
    },
    "/api/v1/scans": {
      post: {
        summary: "문서 업로드 및 즉시 분석",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file", "mode", "consent"],
                properties: {
                  file: { type: "string", format: "binary", description: "PDF, DOCX, HWPX, TXT, PNG, JPG" },
                  mode: { type: "string", enum: ["privacy", "blind_hiring"] },
                  consent: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "분석 완료",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ScanResult" } } },
          },
          "400": { $ref: "#/components/responses/ApiError" },
          "500": { $ref: "#/components/responses/ApiError" },
        },
      },
    },
    "/api/v1/scans/{scanId}/findings/{findingId}": {
      patch: {
        summary: "탐지 항목 승인/수정",
        parameters: [
          { name: "scanId", in: "path", required: true, schema: { type: "string" } },
          { name: "findingId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  action: { type: "string", enum: ["mask", "replace", "delete", "review"] },
                  replacementText: { type: "string", nullable: true },
                  resolved: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "수정 반영됨",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        findingId: { type: "string" },
                        resolved: { type: "boolean" },
                        replacementText: { type: "string", nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
          "404": { $ref: "#/components/responses/ApiError" },
        },
      },
    },
    "/api/v1/scans/{scanId}/safe-copy": {
      post: {
        summary: "안전 사본 생성 및 다운로드",
        parameters: [{ name: "scanId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { format: { type: "string", enum: ["pdf", "docx", "txt"], default: "txt" } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "마스킹 반영된 파일 스트림",
            content: {
              "application/pdf": { schema: { type: "string", format: "binary" } },
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { schema: { type: "string", format: "binary" } },
              "text/plain": { schema: { type: "string" } },
            },
          },
          "404": { $ref: "#/components/responses/ApiError" },
          "500": { $ref: "#/components/responses/ApiError" },
        },
      },
    },
    "/api/v1/scans/{scanId}": {
      delete: {
        summary: "원본 및 분석 결과 삭제",
        parameters: [{ name: "scanId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "삭제됨",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: { type: "object", properties: { scanId: { type: "string" }, deleted: { type: "boolean" } } },
                  },
                },
              },
            },
          },
          "404": { $ref: "#/components/responses/ApiError" },
        },
      },
    },
  },
  components: {
    schemas: {
      Finding: {
        type: "object",
        properties: {
          findingId: { type: "string" },
          type: { type: "string" },
          label: { type: "string" },
          originalText: { type: "string" },
          reason: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          action: { type: "string", enum: ["mask", "replace", "delete", "review"] },
          suggestion: { type: "string", nullable: true },
          page: { type: "integer" },
          startOffset: { type: "integer" },
          endOffset: { type: "integer" },
          resolved: { type: "boolean" },
          replacementText: { type: "string", nullable: true },
        },
      },
      ScanResult: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              scanId: { type: "string" },
              fileName: { type: "string" },
              mode: { type: "string", enum: ["privacy", "blind_hiring"] },
              createdAt: { type: "string", format: "date-time" },
              extractedText: { type: "string" },
              summary: {
                type: "object",
                properties: {
                  needsFix: { type: "integer" },
                  autoMasked: { type: "integer" },
                  passed: { type: "integer" },
                },
              },
              findings: { type: "array", items: { $ref: "#/components/schemas/Finding" } },
            },
          },
        },
      },
    },
    responses: {
      ApiError: {
        description: "에러 응답",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                error: {
                  type: "object",
                  properties: { code: { type: "string" }, message: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
  },
};
