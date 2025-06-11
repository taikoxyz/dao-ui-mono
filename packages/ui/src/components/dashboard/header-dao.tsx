import { PUB_APP_NAME } from "@/constants";

export const HeaderDao = () => {
  return (
    <header className="relative flex w-full justify-center">
      {/* Radial gradients */}
      <section className="absolute right-[80px] top-[70px] -z-10 size-[180px] rounded-full bg-ellipse-34 blur-[120px] sm:right-[80px] sm:size-[320px]" />
      <section className="absolute left-[68px] top-[170px] -z-10 size-[250px] rounded-full bg-ellipse-35 blur-[80px] sm:size-[400px]" />
      <section className="absolute right-[400px] top-[153px] -z-10 hidden size-[540px] rounded-full bg-ellipse-36 blur-[120px] lg:block" />

      <div className="flex w-full max-w-screen-xl flex-col gap-y-6">
        <div className="flex flex-col gap-y-8">
          <div className="md:w-4/5">
            <p className="text-xl leading-normal text-neutral-600 md:text-2xl">
              Welcome to the {PUB_APP_NAME} DAO′s Governance app. Use this tool to engage with the community and shape
              the future direction of the protocol.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-x-20 gap-y-4 sm:flex-row md:w-4/5"></div>
      </div>
    </header>
  );
};
