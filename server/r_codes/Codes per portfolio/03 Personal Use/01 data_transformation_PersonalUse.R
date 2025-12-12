# Step 1 - Load libraries and data

library(data.table)
library(car) # vif()
library(lmtest) # bgtest(), bptest()
library(gtools) # permutations() 
library(tseries) # adf.test()
library(parallel)
library(pbapply)
library(tidyverse)

portfolio = "PersonalUse"

# REQUIREMENTS: No "." in the names of raw variables
x_raw = fread("Inputs/Independent - Raw with Time.csv") 
y_raw = fread(paste0("Inputs/Dependent - Raw with Time", "_", portfolio, ".csv"))
y_raw[,2][y_raw[,2] == 0] = 0.001
y_raw[,2][y_raw[,2] == 1] = 0.99999

x_raw_vars = setdiff(colnames(x_raw),"Time")
y_raw_vars = setdiff(colnames(y_raw),"Time")


# Step 2 - defining transformations to be used on independent and dependent variables

x_differencers = list(diff_12 = ~ .x - lag(.x, n = 12))

x_laggers = list(
  lag_3 = ~ lag(.x, n = 3),
  lag_6 = ~ lag(.x, n = 6),
  lag_9 = ~ lag(.x, n = 9),
  lag_12 = ~ lag(.x, n = 12)
)



y_transformers = list(
  logit = ~ log(.x / (1-.x))
)

# Since we required that the raw variable names do not contain ".", we can use it to denote the transformations
x_transformed = x_raw %>% 
  # Apply ln to raw variables with only strictly positive values
  mutate(across(all_of(x_raw_vars) & where(~ min(.x, na.rm=TRUE) > 0),
                log, 
                .names="{.col}.ln")) %>% 
  # Apply asinh to all raw variables
  mutate(across(all_of(x_raw_vars) & where(~ min(.x, na.rm=TRUE) <= 0), 
                asinh, 
                .names="{.col}.asinh")) %>% 
  # Apply differencing at k = 4 to everything (raw and newly transformed variables)
  mutate(across(!Time, 
                x_differencers, 
                .names="{.col}.{.fn}")) %>% 
  # Apply lags at n = 3, 6, 9, 12 to everything (raw and newly transformed variables)
  mutate(across(!Time, 
                x_laggers, 
                .names="{.col}.{.fn}")) 

y_transformed = y_raw %>% 
  mutate(across(!Time,y_transformers,.names="{.col}.{.fn}"))


fwrite(x_transformed, paste0("Outputs/", portfolio, "/", portfolio, "_Independent - Transformed with Time.csv"))
fwrite(y_transformed, paste0("Outputs/", portfolio, "/", portfolio, "_Dependent - Transformed with Time.csv"))

# Step 3 - ADF test

adf_tester = function(v, alt_hyp = "stationary", lag_order = trunc((length(na.omit(v))-1)^(1/3))) {
  if(length(na.omit(v)) < 4) {
    return(c(p.value = Inf, statistic = Inf))
  } else {
    tr = adf.test(na.omit(v), alternative = alt_hyp, k = lag_order)
    return(c(p.value = tr$p.value, statistic = tr$statistic[[1]]))
  }
}

ADF_test_x = data.frame(var_name = colnames(x_transformed %>% select(-Time)), 
                        t(sapply(x_transformed %>% select(-Time), adf_tester)), 
                        row.names = NULL)

ADF_test_y = data.frame(var_name = colnames(y_transformed %>% select(-Time)), 
                        t(sapply(y_transformed %>% select(-Time), adf_tester)), 
                        row.names = NULL)

fwrite(ADF_test_x, paste0("Outputs/", portfolio, "/", portfolio, "_ADF_test_x.csv"))
fwrite(ADF_test_y, paste0("Outputs/", portfolio, "/", portfolio, "_ADF_test_y.csv"))

# Step 4 - compute correlations between independent variables (MEVs)

x_cor_mat = cor(x_transformed %>% select(-Time), use = "pairwise.complete.obs")



get_max_abs_cor_x = function(var_list, var_cor_mat) {
  max(abs(var_cor_mat[var_list,var_list] - diag(length(var_list))))
}

fwrite(data.frame(name = dimnames(x_cor_mat)[[1]], x_cor_mat), paste0("Outputs/", portfolio, "/", portfolio,"_x_cor_mat.csv"))

# get combinations of variables

# Step 5 - get combinations of variables for MFA

x_base_vars = unique(str_replace(x_raw_vars,"\\..*$", ""))

# change this for each number of variables taken
num_vars_taken = 2
comb_no_lags = t(combn(x_base_vars,num_vars_taken))
comb_extended = comb_no_lags

lvlgr_perms = permutations(3,num_vars_taken,c("",".Level",".GR"), repeats.allowed = TRUE)
lvlgr_perms_repeated = lvlgr_perms[rep(1:nrow(lvlgr_perms),times=nrow(comb_extended)),]

comb_extended = comb_extended[rep(1:nrow(comb_extended),each=nrow(lvlgr_perms)),]
comb_extended[] = paste0(comb_extended,lvlgr_perms_repeated)

# used because not all variables can have .Level and .GR versions
valid_rows_lvlgr = apply(comb_extended,1,function(x) all(x %in% colnames(x_transformed)))
comb_extended = comb_extended[valid_rows_lvlgr,]

rm(lvlgr_perms, lvlgr_perms_repeated, valid_rows_lvlgr)
gc()

trans_perms = permutations(3,num_vars_taken,c("",".ln",".asinh"), repeats.allowed = TRUE)
trans_perms_repeated = trans_perms[rep(1:nrow(trans_perms),times=nrow(comb_extended)),]

comb_extended = comb_extended[rep(1:nrow(comb_extended),each=nrow(trans_perms)),]
comb_extended[] = paste0(comb_extended,trans_perms_repeated)

# used because not all variables can be transformed with ln
valid_rows_trans = apply(comb_extended,1,function(x) all(x %in% colnames(x_transformed)))

comb_extended = comb_extended[valid_rows_trans,]

rm(trans_perms, trans_perms_repeated, valid_rows_trans)
gc()

diff_perms = permutations(length(x_differencers)+1,num_vars_taken,c("",paste0(".",names(x_differencers))), repeats.allowed = TRUE)
diff_perms_repeated = diff_perms[rep(1:nrow(diff_perms),times=nrow(comb_extended)),]

comb_extended = comb_extended[rep(1:nrow(comb_extended),each=nrow(diff_perms)),]
comb_extended[] = paste0(comb_extended,diff_perms_repeated)

rm(diff_perms, diff_perms_repeated)
gc()

lag_perms = permutations(length(x_laggers)+1,num_vars_taken,c("",paste0(".",names(x_laggers))), repeats.allowed = TRUE)
lag_perms_repeated = lag_perms[rep(1:nrow(lag_perms),times=nrow(comb_extended)),]

comb_extended = comb_extended[rep(1:nrow(comb_extended),each=nrow(lag_perms)),]
comb_extended[] = paste0(comb_extended,lag_perms_repeated)


rm(lag_perms, lag_perms_repeated)
gc()

# Step 6 - compute maximum absolute correlations for the combinations

ms_cl <- makeCluster(detectCores())
clusterEvalQ(ms_cl, {
  library(data.table)
  library(car)
  library(lmtest)
  library(gtools)
  library(tseries)
  library(tidyverse)
})

all_comb_df = data.frame(comb_extended, 
                         max_abs_cor = pbapply(cl = ms_cl, comb_extended, 1, get_max_abs_cor_x, var_cor_mat = x_cor_mat))

stopCluster(ms_cl)
rm(ms_cl, comb_extended)
gc()

fwrite(all_comb_df,paste0("Outputs/", portfolio, "/", portfolio,"_", num_vars_taken,"-var_combinations.csv"))

rm(all_comb_df)
gc()
