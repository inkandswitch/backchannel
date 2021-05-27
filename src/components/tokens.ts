const rawColor = {
  blue: '#1E00D6',
  lightBlue: '#A9B7FF',
  lightBlue2: '#8497F7',
  darkBlue: '#07015F',
  darkBlue2: '#1900B4',
  lightestBlue: '#f3f4ff',
  lightGray: '#ADA4FF',
  lighterGray: '#D6D6D6',
  lightererGray: '#5D4FE1',
  green: '#00EC5E',
  white: '#ffffff',
  lightPurple: '#9187EB',
  yellow: '#CC9900',
  red: '#7C0A02',
  lightRed: '#ED0039',
};

/*
css={css`
  color: ${color.textBold};
`}
*/
export const color = {
  primary: rawColor.blue,
  text: rawColor.lightBlue,
  textInverse: rawColor.darkBlue,
  textBold: rawColor.white,
  textSecondary: rawColor.lightGray,
  indicatorOnline: rawColor.green,
  indicatorOffline: rawColor.lighterGray,
  border: rawColor.lightererGray,
  borderInverse: rawColor.darkBlue,
  borderInverseFocus: rawColor.blue,
  backgroundHover: rawColor.darkBlue,
  chatBackgroundIncoming: rawColor.lightBlue,
  chatBackgroundYou: rawColor.white,
  chatHeaderText: rawColor.white,
  chatText: rawColor.darkBlue,
  chatTimestamp: rawColor.lightBlue2,
  primaryButtonBackground: rawColor.white,
  destructiveText: rawColor.lightRed,
  transparentButtonText: rawColor.white,
  transparentButtonBorder: rawColor.white,
  contactListBackground: rawColor.blue,
  codeShareBackground: rawColor.darkBlue,
  codeShareText: rawColor.white,
  codeShareToggleTextActive: rawColor.blue,
  codeShareToggleBackground: rawColor.darkBlue2,
  codeShareToggleBackgroundActive: rawColor.white,
  codeShareToggleText: rawColor.white,
  chatSecondaryText: rawColor.lightPurple,
  warningText: rawColor.white,
  warningBackground: rawColor.yellow,
  errorText: rawColor.white,
  errorBackground: rawColor.red,
};

/*
css={css`
  font-size: ${fontSize[2]}px;
`}
*/
export const fontSize = [10, 12, 14, 24];
