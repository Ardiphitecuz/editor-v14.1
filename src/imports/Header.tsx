import svgPaths from "./svg-etl2zjpson";
import imgRectangle7 from "figma:asset/3faeab794066e6a5837760291e83a4cac94d2503.png";

function Frame1() {
  return (
    <div className="bg-white col-1 content-stretch flex h-[62px] items-center justify-center ml-0 mt-0 pl-[24px] py-[20px] relative row-1">
      <div className="flex flex-col font-['Gilroy-Italic:☞',sans-serif] italic justify-center leading-[0] relative shrink-0 text-[#060200] text-[33px] text-center tracking-[-0.18px] whitespace-nowrap">
        <p className="leading-[22px]">adadaadad</p>
      </div>
    </div>
  );
}

function Group() {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
      <Frame1 />
    </div>
  );
}

function Frame() {
  return (
    <div className="col-1 content-stretch flex items-center ml-[82px] mt-[10px] relative row-1">
      <Group />
      <div className="h-[62px] relative shrink-0 w-[36.486px]">
        <div className="absolute inset-[0_12.15%_0_0]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32.0528 62">
            <path d={svgPaths.p18776b80} fill="var(--fill-0, white)" id="Rectangle 16" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Notif() {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0" data-name="Notif">
      <Frame />
      <div className="col-1 ml-0 mt-0 relative rounded-[10px] row-1 size-[82px]">
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none rounded-[10px]">
          <div className="absolute bg-[#ff742f] inset-0 rounded-[10px]" />
          <img alt="" className="absolute max-w-none mix-blend-multiply object-cover opacity-45 rounded-[10px] size-full" src={imgRectangle7} />
        </div>
      </div>
      <div className="col-1 ml-[12px] mt-[12px] relative row-1 size-[58px]" data-name="notification-bubble">
        <div className="absolute inset-[16.67%]" data-name="Icon">
          <div className="absolute inset-[-3.88%]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 41.667 41.6667">
              <path d={svgPaths.p29f60d00} id="Icon" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Header() {
  return (
    <div className="content-stretch flex flex-col items-start relative size-full" data-name="Header">
      <Notif />
    </div>
  );
}