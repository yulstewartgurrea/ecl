# III. multiple linear regression

# Step 1 - load libraries and data

library(data.table)
library(car) 
library(lmtest) 
library(gtools) 
library(tseries) 
library(parallel)
library(pbapply)
library(tidyverse)

# clear the workspace
rm(list=ls())
gc()

portfolio <- "PersonalUse"
ODR <- "CSB_ODR.logit"

# load transformed dependent and independent variable
x_transformed_w_time = fread(paste0("Outputs/", portfolio, "/", portfolio
                                    ,"_Independent - Transformed with Time.csv")) %>% 
  select(!matches(".asinh.diff_12.lag")) %>%
  select(!matches(".ln.diff_12.lag"))

y_transformed_w_time = fread(paste0("Outputs/", portfolio, "/", portfolio, 
                                    "_Dependent - Transformed with Time.csv"))

regression_data_w_time = y_transformed_w_time %>% left_join(x_transformed_w_time)

x_names = setdiff(colnames(x_transformed_w_time),"Time")
y_names = setdiff(colnames(y_transformed_w_time),"Time")

regression_data = regression_data_w_time %>% select(-Time)

x_data = regression_data %>% select(all_of(x_names))
y_data = regression_data %>% select(all_of(y_names))

colnames(regression_data)
head(regression_data,10)
# Note that there are NAs in the independent variable dataset
# NAs are okay as long as the argument for the lm() function na.action is na.omit (the default)
# Setting the na.action argument in lm() to na.omit will make it so the model is fitted with the rows of the data without NAs in any of the considered variables

# Number of variables to take at a time for each combination
num_vars_taken = 2

# !!! detectCores() will make use of all cores, make sure you have nothing else to do on the PC !!!
ms_cl <- makeCluster(detectCores())
clusterEvalQ(ms_cl, {
  library(data.table)
  library(car)
  library(lmtest)
  library(gtools)
  library(tseries)
  library(tidyverse)
})

mfa_runs_w_cor = fread(paste0("Outputs/", portfolio, "/", portfolio, "_", num_vars_taken,"-var_combinations.csv"))

# Step 2 - Select combinations to run

# mfa_runs is the final matrix of variable combinations
mfa_runs = mfa_runs_w_cor %>% 
  # filter(max_abs_cor >= 0, max_abs_cor < 0.8) %>% 
  slice(1:4000000) %>%
  select(starts_with("X")) %>% 
  filter(!if_any(contains("X"), \(x) grepl("asinh.diff_12.lag", x))) %>%
  filter(!if_any(contains("X"), \(x) grepl("ln.diff_12.lag", x))) %>%
  as.matrix


rm(mfa_runs_w_cor)
gc()

num_comb = nrow(mfa_runs)
num_comb

# the maximum order to consider for Breusch-Godfrey test
max_bgtest_order = 2

# Step 3 - Define stats to be considered for the models

write_model_stats = function(indep_vars, dep_var, lr_data, max_bg_order, portfolio) {
  lr_formula = paste0(dep_var," ~ ",paste0(indep_vars,collapse=" + "))
  lr_model = lm(lr_formula, 
                data = lr_data,
                na.action = na.omit, 
                y = TRUE)
  
  lr_model_summary = summary(lr_model)
  alias_reindex = ifelse(!lr_model_summary$aliased,cumsum(!lr_model_summary$aliased),NA)
  lr_model_summary_stats = lr_model_summary$coefficients[alias_reindex,]
  
  if(any(lr_model_summary$aliased)) {
    lr_model_vif = rep(NA,length(indep_vars))
  } else {
    lr_model_vif = vif(lr_model)
  }
  
  result_names = c("intercept", paste0("coeff_X", 1:length(indep_vars)), 
                   "stderr_intercept", paste0("stderr_X", 1:length(indep_vars)), 
                   "t-value_intercept", paste0("t-value_X", 1:length(indep_vars)), 
                   "p-value_intercept", paste0("p-value_X", 1:length(indep_vars)), 
                   paste0("vif_X", 1:length(indep_vars)), 
                   "R_Squared", 
                   "Adj_R_Squared", 
                   "num_pts_fitted", 
                   "MSE", 
                   "RMSE", 
                   "MAPE", 
                   "AIC", 
                   "BIC", 
                   "ST_pval", 
                   "BT_pval", 
                   "BP_pval", 
                   "DW_pval", 
                   paste0("BG_order",1:max_bg_order,"_pval"))
  
  result_df = c(lr_model_summary_stats[, "Estimate"], 
                lr_model_summary_stats[, "Std. Error"], 
                lr_model_summary_stats[, "t value"], 
                lr_model_summary_stats[, "Pr(>|t|)"], 
                lr_model_vif, 
                lr_model_summary$r.squared, 
                lr_model_summary$adj.r.squared, 
                length(lr_model$residuals), 
                mean(lr_model$residuals^2), 
                sqrt(mean(lr_model$residuals^2)), 
                mean(na_if(abs(
                  ((exp(lr_model$y)/(1 + exp(lr_model$y))) -
                     (exp(lr_model$y - lr_model$residuals)/(1 + exp(lr_model$y - lr_model$residuals))) )
                  /
                    (exp(lr_model$y)/(1 + exp(lr_model$y)))
                ), Inf), na.rm = TRUE), 
                AIC(lr_model), 
                BIC(lr_model), 
                shapiro.test(lr_model$residuals)$p.value, 
                Box.test(lr_model$residuals, type="Ljung-Box")$p.value, 
                bptest(lr_model)$p.value, 
                dwtest(lr_model,order.by=NULL,alternative="two.sided")$p.value, 
                sapply(1:max_bg_order, function(x) bgtest(lr_model, order=x)$p.value)) %>% 
    setNames(result_names) %>% 
    t() %>% 
    as.data.frame()
  
  result_df$Y = dep_var
  result_df[,paste0("X", 1:length(indep_vars))] = indep_vars
  
  result_final = result_df %>% 
    relocate(Y, .before = 1) %>% 
    relocate(all_of(paste0("X", 1:length(indep_vars))), .after = Y)
  
  fwrite(result_final,paste0("Outputs/", portfolio,"/", "mfa_", dep_var, "_", length(indep_vars), "-var_", Sys.getpid(), ".csv"), append=TRUE)
  
  return(NULL)
}

# Step 4 - Run MFA

return_container = pbapply(cl = ms_cl,
                           mfa_runs, 1,
                           write_model_stats,
                           dep_var = ODR,
                           portfolio = portfolio,
                           lr_data = regression_data,
                           max_bg_order = max_bgtest_order)

gc()

stopCluster(ms_cl)
rm(ms_cl)
gc()
