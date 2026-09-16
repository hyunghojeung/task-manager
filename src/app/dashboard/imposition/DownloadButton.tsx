"use client";

// 프로그램 다운로드 버튼. 실행 파일이 올라오기 전까지는 안내만 띄운다.
// 파일이 준비되면 아래 DOWNLOAD_URL 에 경로를 넣으면 바로 내려받기로 바뀐다.
const DOWNLOAD_URL = "";

export default function DownloadButton() {
  if (DOWNLOAD_URL) {
    return (
      <a href={DOWNLOAD_URL} className="inline-block px-8 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded text-base font-bold whitespace-nowrap">
        Bcount 임포지션 프로그램 다운로드
      </a>
    );
  }
  return (
    <button
      onClick={() => alert("프로그램 파일이 준비되면 이 버튼으로 바로 내려받습니다.")}
      className="px-8 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded text-base font-bold whitespace-nowrap"
    >
      Bcount 임포지션 프로그램 다운로드
    </button>
  );
}
