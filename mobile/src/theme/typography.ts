import { TextStyle } from "react-native";

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
    letterSpacing: -0.5,
  } as TextStyle,
  h2: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 30,
    letterSpacing: -0.3,
  } as TextStyle,
  h3: {
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 26,
  } as TextStyle,
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  } as TextStyle,
  body: {
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 22,
  } as TextStyle,
  bodySmall: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
  } as TextStyle,
  caption: {
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 16,
  } as TextStyle,
  button: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
    letterSpacing: 0.2,
  } as TextStyle,
} as const;
