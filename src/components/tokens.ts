const rawColor = {
  blue: '#1E00D6',
  lightBlue: '#A9B7FF',
  lightBlue2: '#8497F7',
  darkBlue: '#07015F',
  lightestBlue: '#f3f4ff',
  lightGray: '#ADA4FF',
  lighterGray: '#D6D6D6',
  lightererGray: '#5D4FE1',
  green: '#00EC5E',
  white: '#ffffff',
  lightPurple: '#9187EB',
};

/*
css={css`
  color: ${color.textBold};
`}
*/
export const color = {
  primary: rawColor.blue,
  text: rawColor.lightBlue,
  textBold: rawColor.white,
  textSecondary: rawColor.lightGray,
  indicatorOnline: rawColor.green,
  indicatorOffline: rawColor.lighterGray,
  border: rawColor.lightererGray,
  backgroundHover: rawColor.darkBlue,
  chatBackgroundIncoming: rawColor.lightBlue,
  chatBackgroundYou: rawColor.white,
  chatHeaderText: rawColor.white,
  chatText: rawColor.darkBlue,
  chatTimestamp: rawColor.lightBlue2,
  backchannelButtonBackground: rawColor.white,
  contactListBackground: rawColor.blue,
  codeShareBackground: rawColor.darkBlue,
  codeShareText: rawColor.white,
  chatSecondaryText: rawColor.lightPurple,
};

/*
css={css`
  font-size: ${fontSize[2]}px;
`}
*/
export const fontSize = [10, 12, 14, 24];
