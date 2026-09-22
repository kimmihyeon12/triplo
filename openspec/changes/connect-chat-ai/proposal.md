# 채팅의 실제 AI 연결

## Why
하단 테마 추천과 자유 질문은 고정 응답에 연결되어 있어 실제 여행 문맥을 반영하지 못했다.

## What Changes
실행 앱에 EdgeChatProvider, 인증된 ai-chat Edge Function, Gemini 구조화 응답 및 공유 응답 검증을 추가한다. 기존 로컬 명령과 장소 검색 대조·사용자 확인은 유지한다. 테스트·시안은 고정 응답을 유지한다. 서버 키는 기존 GEMINI_API_KEY, 모델은 GEMINI_MODEL 설정을 재사용한다.
