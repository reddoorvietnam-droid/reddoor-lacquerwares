"use client";

import { useSo } from "../ui";
import { TabChi } from "./chi";
import { TabChiXuong } from "./chi-xuong";
import { TabCongNo } from "./cong-no";
import { TabCoSo } from "./co-so";
import { TabDanhMuc } from "./danh-muc";
import { TabDonHang } from "./don-hang";
import { TabDonMoi } from "./don-moi";
import { TabKho, TabMuaVt, TabTon } from "./kho";
import { TabBangLuong, TabNhanCong, TabNhanCongVp } from "./nhan-su";
import { TabSanXuat } from "./san-xuat";
import { TabTongQuan } from "./tong-quan";

export function NoiDungTab() {
  const { tab } = useSo();
  switch (tab) {
    case "tongquan":
      return <TabTongQuan />;
    case "donmoi":
      return <TabDonMoi />;
    case "donhang":
      return <TabDonHang />;
    case "sanxuat":
      return <TabSanXuat />;
    case "coso":
      return <TabCoSo />;
    case "congno":
      return <TabCongNo />;
    case "chi":
      return <TabChi />;
    case "nhancong":
      return <TabNhanCong />;
    case "nhancongvp":
      return <TabNhanCongVp />;
    case "bangluong":
      return <TabBangLuong />;
    case "kho":
      return <TabKho />;
    case "ton":
      return <TabTon />;
    case "muavt":
      return <TabMuaVt />;
    case "chixuong":
      return <TabChiXuong />;
    case "danhmuc":
      return <TabDanhMuc />;
  }
}
