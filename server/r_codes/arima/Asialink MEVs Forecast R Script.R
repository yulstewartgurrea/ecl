# Quarterly Forecasting ========================================================
#Packages

library(plyr)
library(dplyr)
library(car)
library(picante)
library(beepr)
library(MASS)
library(forecast)
library(urca)
library(tseries)
library(lmtest)
library(astsa)
library(orcutt)
library(writexl)
library(readxl)

select <- dplyr::select

#Quarterly Independent variables
independent <- read_excel("Input/MEV Historical Data.xlsx", sheet = "Quarterly MEVs")

independent = independent[-1]
independent = sapply(independent, function(x) as.numeric(x)) %>% as.data.frame

independent = independent[, 1:2]

#Forecast
variables  = names(independent)

Forecast = function(x){
  
  data       = independent[, x]
  data.ts    = data %>% ts(start = c(2013, 1), end = c(2023, 4), freq = 4)
  fit        = auto.arima(data.ts, allowdrift = FALSE, seasonal = TRUE)
  forecast   = forecast(fit, h=5) #n.ahead = 12 
  forecast   = as.data.frame(forecast)
  actual     = replicate(5,as.data.frame(data.ts)$x) %>% as.data.frame()
  cnames     = colnames(forecast)
  colnames(forecast) <- paste0(x,"_",cnames)
  colnames(actual) <- paste0(x,"_",cnames)
  rownames(actual) <- as.yearmon(time(data.ts))
  alldat     = rbind(actual,forecast)
  return(alldat)
}

Forecast_variables    = lapply(variables, Forecast)
Consolidated_forecast = do.call("cbind", Forecast_variables)
#Consolidated_forecast$Date <- rownames(Consolidated_forecast)
#Consolidated_forecast = Consolidated_forecast |> dplyr::select("Date", everything())

write_xlsx(Consolidated_forecast, "Output/Asialink GOC Forecasts Quarterly MEVs.xlsx")



# Monthly Forecasting ==========================================================
# clear workspace
rm(list = ls())

#Packages
library(plyr)
library(dplyr)
library(car)
library(picante)
library(beepr)
library(MASS)
library(forecast)
library(urca)
library(tseries)
library(lmtest)
library(astsa)
library(orcutt)
library(writexl)
library(readxl)

select <- dplyr::select

#Quarterly Independent variables
independent <- read_excel("Input/MEV Historical Data.xlsx", sheet = "Monthly MEVs")

independent = independent[-1]
independent = sapply(independent, function(x) as.numeric(x)) %>% as.data.frame

#independent = independent[, 1:1]

#Forecast
variables  = names(independent)

Forecast = function(x){
  
  data       = independent[, x]
  data.ts    = data %>% ts(start = c(2013, 1), end = c(2024, 1), freq = 12)
  fit        = auto.arima(data.ts, allowdrift = FALSE, seasonal = TRUE)
  forecast   = forecast(fit, h=12) #n.ahead 
  forecast   = as.data.frame(forecast)
  actual     = replicate(5,as.data.frame(data.ts)$x) %>% as.data.frame()
  cnames     = colnames(forecast)
  colnames(forecast) <- paste0(x,"_",cnames)
  colnames(actual) <- paste0(x,"_",cnames)
  rownames(actual) <- as.yearmon(time(data.ts))
  alldat     = rbind(actual,forecast)
  return(alldat)
}

Forecast_variables    = lapply(variables, Forecast)
Consolidated_forecast = do.call("cbind", Forecast_variables)
#Consolidated_forecast$Date <- rownames(Consolidated_forecast)
#Consolidated_forecast = Consolidated_forecast |> dplyr::select("Date", everything())

write_xlsx(Consolidated_forecast, "Output/Asialink GOC Forecasts Monthly MEVs.xlsx")

