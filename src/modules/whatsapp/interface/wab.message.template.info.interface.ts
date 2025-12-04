export interface MessageTemplateInfo {
  id: string;
  status: string;
  category: string;
}


/* ── Component Types ─────────────────────────────── */
export type COMPONENT_TYPE = 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
export type HEADER_FORMAT = 'TEXT' | 'LOCATION' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
export type BUTTON_FORMAT = 'PHONE_NUMBER' | 'URL' | 'COPY_CODE' | 'FLOW' | 'QUICK_REPLY' | "CATALOG";

/* ── Base ────────────────────────────────────────── */
interface BaseComponent {
  componentType: COMPONENT_TYPE;
}

/* ── HEADER Variants ─────────────────────────────── */
interface HeaderBase extends BaseComponent {
  componentType: 'HEADER';
  format: HEADER_FORMAT;
}

export interface HeaderText extends HeaderBase {
  format: 'TEXT';
  text: string;
}

export interface HeaderLocation extends HeaderBase {
  format: 'LOCATION';
}

export interface HeaderImage extends HeaderBase {
  format: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  header_handle: string; // media id
}

export type HeaderComponent = HeaderText | HeaderLocation | HeaderImage;

/* ── BODY (Required) ─────────────────────────────── */
export interface BodyComponent extends BaseComponent {
  componentType: 'BODY';
  text: string; // with placeholders {{1}}, {{2}}, etc.
}

/* ── FOOTER ─────────────────────────────────────── */
export interface FooterComponent extends BaseComponent {
  componentType: 'FOOTER';
  text: string;
}

/* ── BUTTON Variants ────────────────────────────── */
interface ButtonBase {
  format: BUTTON_FORMAT;
  text: string;
}

export interface ButtonNumber extends ButtonBase {
  format: 'PHONE_NUMBER';
  phone_number: string;
}

export interface ButtonUrl extends ButtonBase {
  format: 'URL';
  url: string;
}

export interface ButtonCopyCode extends ButtonBase {
  format: 'COPY_CODE';
  example?: string; // optional example code
}

export interface ButtonFlow extends ButtonBase {
  format: 'FLOW';
  flow_id: string;
}

export interface ButtonQuickReply extends ButtonBase {
  format: 'QUICK_REPLY';
}

export type Button =
  | ButtonNumber
  | ButtonUrl
  | ButtonCopyCode
  | ButtonFlow
  | ButtonQuickReply;

export interface ButtonsComponent extends BaseComponent {
  componentType: 'BUTTONS';
  buttons: Button[];
}

/* ── Union of All Components ────────────────────── */
export type Component =
  | BodyComponent // required at least one
  | HeaderComponent
  | FooterComponent
  | ButtonsComponent;

/* ── Full Template Type ─────────────────────────── */
export interface ITemplateComponent {
  components: Component[];
}
