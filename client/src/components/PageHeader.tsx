import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

/**
 * Прилипающая шапка экрана. Использовать как первого ребёнка в обёртке
 * с p-5 / px-5 — `-mx-5 -mt-5 px-5 pt-5` делает фон во всю ширину контейнера
 * до самого края, sticky top-0 пинит её к верху скролл-контейнера (main).
 */
export function PageHeader({ children }: Props) {
  return (
    <div
      className={[
        "sticky top-0 z-20",
        "-mx-5 -mt-5 px-5 pt-5 pb-3 mb-1",
        "bg-bg-primary/85 backdrop-blur-md",
      ].join(" ")}
    >
      {children}
    </div>
  );
}
