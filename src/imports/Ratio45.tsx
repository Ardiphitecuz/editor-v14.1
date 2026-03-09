import svgPaths from "./svg-0zf9wwjyvn";

import { imgImage } from "./svg-icg6q";

function Backround() {
  return (
    <div className="-translate-y-1/2 absolute contents left-0 top-[calc(50%+6.5px)]" data-name="backround">
      <div className="absolute h-[2320px] left-0 mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[0px_0px] mask-size-[1856px_2333px] top-0 w-[1856px]" data-name="image" style={{ maskImage: `url('${imgImage}')` }}>
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgImage1} />
      </div>
      <div className="absolute bg-gradient-to-b from-[3.833%] from-[rgba(0,0,0,0)] h-[640px] left-0 mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[0px_-1693px] mask-size-[1856px_2333px] to-[84.1%] to-[rgba(0,0,0,0.68)] top-[1693px] w-[1856px]" style={{ maskImage: `url('${imgImage}')` }} />
    </div>
  );
}

function Frame1() {
  return (
    <div className="bg-white col-1 content-stretch flex h-[62px] items-center justify-center ml-0 mt-0 pl-[24px] py-[20px] relative row-1">
      <div className="flex flex-col font-['Gilroy-BoldItalic:☞',sans-serif] italic justify-center leading-[0] relative shrink-0 text-[#060200] text-[33px] text-center tracking-[-0.18px] whitespace-nowrap">
        <p className="leading-[22px]">Discuss</p>
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

function Header() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-[232px]" data-name="Header">
      <Notif />
    </div>
  );
}

function Content() {
  return (
    <div className="relative rounded-[30px] shrink-0 w-full" data-name="Content">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none rounded-[30px]">
        <div className="absolute bg-[#ff742f] inset-0 rounded-[30px]" />
        <img alt="" className="absolute max-w-none mix-blend-multiply object-cover opacity-25 rounded-[30px] size-full" src={imgContent} />
      </div>
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex items-center justify-center pb-[69px] pt-[61px] px-[112px] relative w-full">
          <div className="capitalize flex flex-col font-['Gilroy-Bold:☞',sans-serif] justify-end leading-[0] not-italic overflow-hidden relative shrink-0 text-[85px] text-ellipsis text-white w-[1339px]">
            <p>
              <span className="leading-[normal]">{`Heboh! `}</span>
              <span className="font-['Gilroy-Heavy:☞',sans-serif] leading-[normal] not-italic">{`Fanart "Dandadan" Versi Kulit Hitam Picu Perang Rasial`}</span>
              <span className="leading-[normal]">{` di Kalangan netizen.`}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderAndContent() {
  return (
    <div className="-translate-x-1/2 absolute bottom-[359px] content-stretch flex flex-col gap-[85px] items-start left-[calc(50%+0.5px)] w-[1563px]" data-name="Header and Content">
      <Header />
      <Content />
      <div className="absolute bg-[#d9d9d9] h-[4px] left-[1152px] top-[60px] w-[60px]" />
    </div>
  );
}

function Footer() {
  return (
    <div className="absolute contents left-[147.38px] top-[1922.55px]" data-name="Footer">
      <div className="absolute h-[133.453px] left-[147.38px] rounded-[18px] top-[1922.55px] w-[1562.246px]" data-name="Identity Bar">
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[18px]">
          <img alt="" className="absolute h-[1176.47%] left-0 max-w-none top-[-1076.47%] w-full" src={imgIdentityBar} />
        </div>
      </div>
    </div>
  );
}

function SourceGambar() {
  return (
    <div className="absolute backdrop-blur-[18.9px] bg-[rgba(255,255,255,0.08)] content-stretch flex gap-[12px] items-center left-[147px] px-[16px] py-[11px] rounded-[10px] top-[2126px]" data-name="Source Gambar">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.14)] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="relative shrink-0 size-[30px]" data-name="image-03">
        <div className="absolute inset-[12.5%]" data-name="Icon">
          <div className="absolute inset-[-4.44%]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24.5 24.5">
              <path d={svgPaths.p3eb20f0} fill="var(--stroke-0, white)" id="Icon" />
            </svg>
          </div>
        </div>
      </div>
      <div className="flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold justify-center leading-[0] not-italic relative shrink-0 text-[0px] text-white tracking-[-0.18px] whitespace-nowrap">
        <p className="leading-[22px] text-[16px]">X.com/@Lynn6Thorex</p>
      </div>
    </div>
  );
}

export default function Ratio() {
  return (
    <div className="bg-white relative size-full" data-name="Ratio 4;5">
      <Backround />
      <HeaderAndContent />
      <Footer />
      <SourceGambar />
    </div>
  );
}